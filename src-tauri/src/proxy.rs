use std::sync::{Arc, Mutex, OnceLock};

use axum::body::Bytes;
use axum::extract::ws::{Message as AxumMessage, WebSocket, WebSocketUpgrade};
use axum::extract::{OriginalUri, State};
use axum::http::{HeaderMap, HeaderName, HeaderValue, Method, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Router;
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::tungstenite::protocol::CloseFrame as TsCloseFrame;
use tokio_tungstenite::tungstenite::Message as TsMessage;

pub struct ProxyState {
    pub target: Mutex<Option<String>>,
    pub base: OnceLock<String>,
}

impl Default for ProxyState {
    fn default() -> Self {
        Self {
            target: Mutex::new(None),
            base: OnceLock::new(),
        }
    }
}

fn current_target(state: &ProxyState) -> Option<String> {
    state.target.lock().unwrap().clone()
}

fn to_ws_scheme(url: &str) -> String {
    if let Some(rest) = url.strip_prefix("https://") {
        format!("wss://{rest}")
    } else if let Some(rest) = url.strip_prefix("http://") {
        format!("ws://{rest}")
    } else {
        url.to_string()
    }
}

pub async fn start(state: Arc<ProxyState>) -> Result<String, Box<dyn std::error::Error>> {
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await?;
    let port = listener.local_addr()?.port();
    let base = format!("http://127.0.0.1:{port}");

    let _ = state.base.set(base.clone());

    let app = Router::new().fallback(handler).with_state(state.clone());

    tauri::async_runtime::spawn(async move {
        let _ = axum::serve(listener, app).await;
    });

    Ok(base)
}

async fn handler(
    State(state): State<Arc<ProxyState>>,
    uri: OriginalUri,
    method: Method,
    headers: HeaderMap,
    ws: Option<WebSocketUpgrade>,
    body: Bytes,
) -> Response {
    let target = match current_target(&state) {
        Some(t) => t,
        None => return (StatusCode::BAD_GATEWAY, "no target configured").into_response(),
    };

    let path_and_query = uri
        .path_and_query()
        .map(|pq| pq.as_str())
        .unwrap_or("/");

    if let Some(ws) = ws {
        let ws_url = format!("{}{}", to_ws_scheme(&target), path_and_query);
        return ws
            .on_upgrade(move |socket| handle_ws(socket, ws_url))
            .into_response();
    }

    forward_http(&target, method, headers, body, path_and_query).await
}

fn cors_preflight_response(req_headers: &HeaderMap) -> Response {
    let mut headers = HeaderMap::new();

    if let Some(origin) = req_headers.get(axum::http::header::ORIGIN) {
        headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            origin.clone(),
        );
    } else {
        headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            HeaderValue::from_static("*"),
        );
    }

    headers.insert(
        axum::http::header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PUT, DELETE, OPTIONS"),
    );

    if let Some(requested) = req_headers.get("access-control-request-headers") {
        headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_HEADERS,
            requested.clone(),
        );
    } else {
        headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_HEADERS,
            HeaderValue::from_static("*"),
        );
    }

    headers.insert(
        axum::http::header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
        HeaderValue::from_static("true"),
    );

    let mut resp = Response::builder().status(StatusCode::NO_CONTENT);
    *resp.headers_mut().unwrap() = headers;
    resp.body(axum::body::Body::empty()).unwrap()
}

fn skip_header(name: &HeaderName) -> bool {
    let name = name.as_str().to_ascii_lowercase();
    matches!(
        name.as_str(),
        "host"
            | "connection"
            | "keep-alive"
            | "upgrade"
            | "content-length"
            | "transfer-encoding"
            | "te"
            | "trailer"
            | "proxy-authorization"
            | "proxy-connection"
    ) || name.starts_with("sec-websocket")
}

fn is_hop_by_hop(name: &HeaderName) -> bool {
    let name = name.as_str().to_ascii_lowercase();
    matches!(
        name.as_str(),
        "content-length" | "transfer-encoding" | "connection" | "keep-alive" | "upgrade"
    )
}

async fn forward_http(
    target: &str,
    method: Method,
    headers: HeaderMap,
    body: Bytes,
    path_and_query: &str,
) -> Response {
    let url = format!("{}{}", target.trim_end_matches('/'), path_and_query);

    if method == Method::OPTIONS {
        return cors_preflight_response(&headers);
    }

    let mut builder = reqwest::Client::new().request(method, &url);

    for (name, value) in headers.iter() {
        if skip_header(name) {
            continue;
        }
        builder = builder.header(name, value);
    }

    let resp = match builder.body(body).send().await {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                format!("proxy error: {e}"),
            )
                .into_response();
        }
    };

    let status = resp.status();
    let mut out_headers = HeaderMap::new();

    for (name, value) in resp.headers().iter() {
        if is_hop_by_hop(name) {
            continue;
        }
        out_headers.insert(name, value.clone());
    }

    if let Some(origin) = headers.get(axum::http::header::ORIGIN) {
        out_headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            origin.clone(),
        );
        out_headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_CREDENTIALS,
            HeaderValue::from_static("true"),
        );
    } else {
        out_headers.insert(
            axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN,
            HeaderValue::from_static("*"),
        );
    }

    let body_bytes = match resp.bytes().await {
        Ok(b) => b,
        Err(_) => Bytes::new(),
    };

    let mut resp_builder = Response::builder().status(status);
    *resp_builder.headers_mut().unwrap() = out_headers;
    resp_builder
        .body(axum::body::Body::from(body_bytes))
        .unwrap()
}

fn to_axum_message(msg: TsMessage) -> Option<AxumMessage> {
    Some(match msg {
        TsMessage::Text(t) => AxumMessage::Text(t),
        TsMessage::Binary(b) => AxumMessage::Binary(b),
        TsMessage::Ping(p) => AxumMessage::Ping(p),
        TsMessage::Pong(p) => AxumMessage::Pong(p),
        TsMessage::Close(c) => AxumMessage::Close(c.map(|f| axum::extract::ws::CloseFrame {
            code: f.code.into(),
            reason: f.reason,
        })),
        TsMessage::Frame(_) => return None,
    })
}

fn to_tungstenite_message(msg: AxumMessage) -> TsMessage {
    match msg {
        AxumMessage::Text(t) => TsMessage::Text(t),
        AxumMessage::Binary(b) => TsMessage::Binary(b),
        AxumMessage::Ping(p) => TsMessage::Ping(p),
        AxumMessage::Pong(p) => TsMessage::Pong(p),
        AxumMessage::Close(c) => TsMessage::Close(c.map(|f| TsCloseFrame {
            code: f.code.into(),
            reason: f.reason,
        })),
    }
}

async fn handle_ws(socket: WebSocket, ws_url: String) {
    let (mut user_sink, mut user_stream) = socket.split();

    let (mut up_sink, mut up_stream) = match tokio_tungstenite::connect_async(&ws_url).await {
        Ok((ws_stream, _response)) => ws_stream.split(),
        Err(e) => {
            eprintln!("[proxy] ws upstream connect failed: {ws_url} -> {e}");
            let _ = user_sink.close().await;
            return;
        }
    };

    eprintln!("[proxy] ws connected to {ws_url}");

    let to_user = tokio::spawn(async move {
        while let Some(Ok(msg)) = up_stream.next().await {
            let Some(msg) = to_axum_message(msg) else {
                continue;
            };
            if user_sink.send(msg).await.is_err() {
                break;
            }
        }
    });

    let to_upstream = tokio::spawn(async move {
        while let Some(Ok(msg)) = user_stream.next().await {
            if up_sink.send(to_tungstenite_message(msg)).await.is_err() {
                break;
            }
        }
    });

    let _ = tokio::try_join!(to_user, to_upstream);
}
