#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod proxy;

use std::fs;
use std::path::Path;
use std::sync::Arc;

use base64::Engine;
use serde_json::{json, Value};
use tauri::Manager;

fn config_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path().app_config_dir().map_err(|e| e.to_string())
}

fn config_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    Ok(config_dir(app)?.join("config.json"))
}

fn write_config(file: &Path, config: &Value) -> Result<(), String> {
    if let Some(parent) = file.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let text = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;

    fs::write(file, text).map_err(|e| e.to_string())
}

fn read_existing(file: &Path) -> Result<Value, String> {
    if file.exists() {
        let text = fs::read_to_string(file).map_err(|e| e.to_string())?;

        if text.trim().is_empty() {
            return Ok(Value::Null);
        }

        serde_json::from_str(&text).map_err(|e| e.to_string())
    } else {
        Ok(Value::Null)
    }
}

fn ensure_device_id(mut config: Value) -> (Value, bool) {
    let mut changed = false;

    if let Some(obj) = config.as_object_mut() {
        let has_valid = obj
            .get("deviceId")
            .and_then(|v| v.as_str())
            .map(|s| uuid::Uuid::parse_str(s).is_ok())
            .unwrap_or(false);

        if !has_valid {
            obj.insert(
                "deviceId".into(),
                Value::String(uuid::Uuid::new_v4().to_string()),
            );
            changed = true;
        }
    }

    (config, changed)
}

fn merge_json(mut base: Value, incoming: Value) -> Value {
    if let (Some(base_obj), Some(inc_obj)) = (base.as_object_mut(), incoming.as_object()) {
        for (k, v) in inc_obj {
            base_obj.insert(k.clone(), v.clone());
        }

        base
    } else {
        incoming
    }
}

#[tauri::command]
fn load_config(app: tauri::AppHandle) -> Result<Value, String> {
    let file = config_file(&app)?;

    let mut config = read_existing(&file)?;

    if config.is_null() {
        config = json!({
            "deviceId": uuid::Uuid::new_v4().to_string(),
            "deviceName": "TicketMachine",
            "server": "",
        });

        write_config(&file, &config)?;
    } else {
        let (new_config, changed) = ensure_device_id(config);

        config = new_config;

        if changed {
            write_config(&file, &config)?;
        }
    }

    Ok(json!({
        "success": true,
        "config": config
    }))
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: Value) -> Result<Value, String> {
    let file = config_file(&app)?;

    let existing = read_existing(&file)?;
    let (existing, _) = ensure_device_id(existing);

    let device_id = existing.get("deviceId").cloned().unwrap_or(Value::Null);

    let mut saved = merge_json(existing, config);

    if let Some(obj) = saved.as_object_mut() {
        obj.insert("deviceId".into(), device_id);
    }

    write_config(&file, &saved)?;

    Ok(json!({
        "success": true,
        "config": saved
    }))
}

#[tauri::command]
fn read_image_data_url(path: String) -> Result<Value, String> {
    let data = fs::read(&path).map_err(|e| e.to_string())?;

    let ext = Path::new(&path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let mime = match ext.as_str() {
        "svg" => "image/svg+xml",
        "jpg" | "jpeg" => "image/jpeg",
        "png" => "image/png",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "bmp" => "image/bmp",
        _ => "application/octet-stream",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&data);

    Ok(json!({
        "success": true,
        "dataUrl": format!("data:{mime};base64,{b64}"),
    }))
}

#[tauri::command]
fn get_app_version(app: tauri::AppHandle) -> Result<Value, String> {
    Ok(json!({
        "success": true,
        "version": app.package_info().version.to_string()
    }))
}

/* ============================================================
WINDOWS PRINTERS
============================================================ */

#[cfg(windows)]
mod printers {
    use std::slice;

    use windows::core::{HSTRING, PCWSTR, PWSTR};
    use windows::Win32::Graphics::Printing::{
        ClosePrinter, EndDocPrinter, EndPagePrinter, EnumPrintersW, GetDefaultPrinterW,
        OpenPrinterW, StartDocPrinterW, StartPagePrinter, WritePrinter, DOC_INFO_1W,
        PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL, PRINTER_HANDLE, PRINTER_INFO_4W,
    };

    fn default_printer() -> String {
        let mut buf = [0u16; 512];
        let mut size = buf.len() as u32;

        let ok = unsafe { GetDefaultPrinterW(Some(PWSTR(buf.as_mut_ptr())), &mut size) };

        if !ok.as_bool() {
            return String::new();
        }

        unsafe { PWSTR(buf.as_mut_ptr()).display().to_string() }
    }

    pub fn list() -> Vec<serde_json::Value> {
        let mut printers: Vec<serde_json::Value> = Vec::new();

        let default_name = default_printer();

        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;

        let mut needed: u32 = 0;
        let mut returned: u32 = 0;

        /*
         * First call:
         * Ask Windows how much memory is required.
         */
        unsafe {
            let _ = EnumPrintersW(flags, None, 4, None, &mut needed, &mut returned);
        }

        if needed == 0 {
            return printers;
        }

        /*
         * Allocate the required buffer.
         */
        let mut buffer = vec![0u64; needed.div_ceil(8) as usize];

        let mut returned: u32 = 0;
        let mut size = needed;

        /*
         * Second call:
         * Actually retrieve the printers.
         */
        let ok = unsafe {
            EnumPrintersW(
                flags,
                None,
                4,
                Some(slice::from_raw_parts_mut(
                    buffer.as_mut_ptr().cast::<u8>(),
                    buffer.len() * 8,
                )),
                &mut size,
                &mut returned,
            )
        };

        if ok.is_err() || returned == 0 {
            return printers;
        }

        let entries = unsafe {
            slice::from_raw_parts(buffer.as_ptr() as *const PRINTER_INFO_4W, returned as usize)
        };

        for entry in entries {
            let name = unsafe { entry.pPrinterName.display() }.to_string();

            if name.is_empty() {
                continue;
            }

            printers.push(serde_json::json!({
                "name": name,
                "displayName": name,
                "isDefault": !default_name.is_empty() && name == default_name,
            }));
        }

        printers
    }

    pub fn raw_print(printer_name: &str, payload: &[u8]) -> Result<(), String> {
        let wide_name = HSTRING::from(printer_name);

        let mut handle = PRINTER_HANDLE::default();

        unsafe {
            OpenPrinterW(PCWSTR(wide_name.as_ptr()), &mut handle, None)
                .map_err(|e| format!("could not open printer '{printer_name}': {e}"))?;
        }

        let outcome = unsafe {
            let doc_name = HSTRING::from("Keues Ticket");
            let datatype = HSTRING::from("RAW");

            let doc = DOC_INFO_1W {
                pDocName: PWSTR(doc_name.as_ptr().cast_mut()),
                pDatatype: PWSTR(datatype.as_ptr().cast_mut()),
                pOutputFile: PWSTR::null(),
            };

            let job_id = StartDocPrinterW(handle, 1, &doc);

            if job_id == 0 {
                Err("could not start print job".to_string())
            } else if StartPagePrinter(handle).as_bool()
                && write_all(handle, payload)
                && EndPagePrinter(handle).as_bool()
                && EndDocPrinter(handle).as_bool()
            {
                Ok(())
            } else {
                Err("error sending data to printer".to_string())
            }
        };

        unsafe {
            let _ = ClosePrinter(handle);
        }

        outcome
    }

    unsafe fn write_all(handle: PRINTER_HANDLE, payload: &[u8]) -> bool {
        let mut offset = 0usize;

        while offset < payload.len() {
            let chunk = &payload[offset..];
            let mut written = 0u32;

            let ok = WritePrinter(
                handle,
                chunk.as_ptr().cast(),
                chunk.len().min(u32::MAX as usize) as u32,
                &mut written,
            );

            if !ok.as_bool() || written == 0 {
                return false;
            }

            offset += written as usize;
        }

        true
    }
}

/* ============================================================
NON-WINDOWS
============================================================ */

#[cfg(not(windows))]
mod printers {
    pub fn list() -> Vec<serde_json::Value> {
        Vec::new()
    }

    pub fn raw_print(_printer_name: &str, _payload: &[u8]) -> Result<(), String> {
        Err("printing is only supported on Windows".to_string())
    }
}

/* ============================================================
TAURI COMMANDS
============================================================ */

#[tauri::command]
fn list_printers() -> Result<Value, String> {
    Ok(json!({
        "success": true,
        "printers": printers::list()
    }))
}

#[derive(serde::Deserialize)]
struct TicketLine {
    text: String,
    #[serde(default)]
    bold: bool,
    #[serde(default)]
    center: bool,
    #[serde(default)]
    big: bool,
}

#[tauri::command]
fn print_ticket(printer: String, lines: Vec<TicketLine>) -> Result<Value, String> {
    let mut payload: Vec<u8> = Vec::new();

    payload.extend_from_slice(b"\x1b@");

    for line in &lines {
        payload.extend_from_slice(if line.center {
            b"\x1b\x61\x01"
        } else {
            b"\x1b\x61\x00"
        });

        payload.extend_from_slice(if line.bold {
            b"\x1b\x45\x01"
        } else {
            b"\x1b\x45\x00"
        });

        payload.extend_from_slice(if line.big {
            &[0x1d, 0x21, 0x11]
        } else {
            &[0x1d, 0x21, 0x00]
        });

        let (encoded, _, _) = encoding_rs::WINDOWS_1252.encode(&line.text);

        payload.extend_from_slice(&encoded);
        payload.extend_from_slice(b"\r\n");
    }

    payload.extend_from_slice(b"\n\n\n");
    payload.extend_from_slice(&[0x1d, 0x56, 0x42, 0x00]);

    printers::raw_print(&printer, &payload)?;

    Ok(json!({ "success": true }))
}

#[tauri::command]
fn get_proxy_base(state: tauri::State<'_, Arc<proxy::ProxyState>>) -> Result<String, String> {
    state
        .base
        .get()
        .cloned()
        .ok_or_else(|| "proxy not started".to_string())
}

#[tauri::command]
fn set_proxy_target(
    state: tauri::State<'_, Arc<proxy::ProxyState>>,
    url: String,
) -> Result<(), String> {
    let mut trimmed = url.trim().to_string();

    if !trimmed.is_empty()
        && !trimmed.starts_with("http://")
        && !trimmed.starts_with("https://")
        && !trimmed.starts_with("ws://")
        && !trimmed.starts_with("wss://")
    {
        trimmed = format!("http://{trimmed}");
    }

    trimmed = trimmed.trim_end_matches('/').to_string();

    if trimmed.is_empty() {
        *state.target.lock().unwrap() = None;
    } else {
        *state.target.lock().unwrap() = Some(trimmed);
    }

    Ok(())
}

/* ============================================================
MAIN
============================================================ */

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let proxy_state = Arc::new(proxy::ProxyState::default());

            tauri::async_runtime::block_on(proxy::start(proxy_state.clone()))?;

            app.manage(proxy_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            load_config,
            save_config,
            read_image_data_url,
            get_app_version,
            list_printers,
            print_ticket,
            get_proxy_base,
            set_proxy_target
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
