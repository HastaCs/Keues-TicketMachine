#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod proxy;

use std::fs;
use std::path::Path;
use std::sync::Arc;

use base64::Engine;
use serde_json::{json, Value};
use tauri::Manager;

fn config_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map_err(|e| e.to_string())
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

    Ok(json!({ "success": true, "config": config }))
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

    Ok(json!({ "success": true, "config": saved }))
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
    Ok(json!({ "success": true, "version": app.package_info().version.to_string() }))
}

#[cfg(windows)]
mod printers {
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;
    use std::slice;

    use windows::core::PWSTR;
    use windows::Win32::Graphics::Printing::{
        EnumPrintersW, GetDefaultPrinterW, PRINTER_ENUM_CONNECTIONS, PRINTER_ENUM_LOCAL,
    };

    #[repr(C)]
    struct PrinterInfo2W {
        p_server_name: *mut u16,
        p_printer_name: *mut u16,
        p_share_name: *mut u16,
        p_port_name: *mut u16,
        p_driver_name: *mut u16,
        p_comment: *mut u16,
        p_location: *mut u16,
        p_dev_mode: *mut core::ffi::c_void,
        p_sep_file: *mut u16,
        p_print_processor: *mut u16,
        p_datatype: *mut u16,
        p_parameters: *mut u16,
        p_security_descriptor: *mut core::ffi::c_void,
        attributes: u32,
        priority: u32,
        default_priority: u32,
        start_time: u32,
        until_time: u32,
        status: u32,
        c_jobs: u32,
        average_ppm: u32,
        p_printer_status: *mut core::ffi::c_void,
        p_last_error: *mut core::ffi::c_void,
        p_extended_status: *mut core::ffi::c_void,
    }

    fn wide_to_string(ptr: *const u16) -> Option<String> {
        if ptr.is_null() {
            return None;
        }
        let mut len = 0;
        unsafe {
            while *ptr.add(len) != 0 {
                len += 1;
            }
        }
        let slice = unsafe { slice::from_raw_parts(ptr, len) };
        let os = OsString::from_wide(slice);
        Some(os.to_string_lossy().into_owned())
    }

    fn default_printer() -> String {
        let mut buf = [0u16; 512];
        let mut size = buf.len() as u32;
        let ok = unsafe { GetDefaultPrinterW(Some(PWSTR(buf.as_mut_ptr())), &mut size) };
        if ok.is_ok() {
            wide_to_string(buf.as_ptr()).unwrap_or_default()
        } else {
            String::new()
        }
    }

    fn enum_printers(flags: u32, level: u32) -> Vec<u8> {
        let mut needed: u32 = 0;
        let mut returned: u32 = 0;

        unsafe {
            EnumPrintersW(
                flags,
                PWSTR::null(),
                level,
                None,
                &mut needed,
                &mut returned,
            );
        }

        if needed == 0 {
            return Vec::new();
        }

        let mut buffer = vec![0u8; needed as usize];
        let mut returned: u32 = 0;
        let mut size = needed;

        unsafe {
            EnumPrintersW(
                flags,
                PWSTR::null(),
                level,
                Some(buffer.as_mut_slice()),
                &mut size,
                &mut returned,
            );
        }

        let count = returned as usize;
        let record_size = std::mem::size_of::<PrinterInfo2W>();
        buffer.truncate(count * record_size);
        buffer
    }

    pub fn list() -> Vec<serde_json::Value> {
        let mut printers: Vec<serde_json::Value> = Vec::new();
        let default_name = default_printer();

        let flags = PRINTER_ENUM_LOCAL | PRINTER_ENUM_CONNECTIONS;
        let buffer = enum_printers(flags, 2);

        let record_size = std::mem::size_of::<PrinterInfo2W>();
        let count = buffer.len() / record_size;
        let ptr = buffer.as_ptr() as *const PrinterInfo2W;

        for i in 0..count {
            let entry = unsafe { &*ptr.add(i) };
            let name = match wide_to_string(entry.p_printer_name) {
                Some(n) if !n.is_empty() => n,
                _ => continue,
            };
            printers.push(serde_json::json!({
                "name": name,
                "displayName": name,
                "isDefault": !default_name.is_empty() && name == default_name,
            }));
        }

        printers
    }
}

#[cfg(not(windows))]
mod printers {
    pub fn list() -> Vec<serde_json::Value> {
        Vec::new()
    }
}

#[tauri::command]
fn list_printers() -> Result<Value, String> {
    Ok(json!({ "success": true, "printers": printers::list() }))
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
            get_proxy_base,
            set_proxy_target
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
