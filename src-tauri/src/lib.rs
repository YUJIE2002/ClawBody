//! ClawBody — Tauri backend
//!
//! Handles native window management, system tray, and bridges
//! the frontend VRM renderer to the OpenClaw agent framework.

use tauri::Manager;

/// Toggle window visibility (for system tray click).
#[tauri::command]
fn toggle_visibility(window: tauri::Window) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Move the companion window to a specific position.
/// Useful for "follow cursor" or "snap to edge" behaviors.
#[tauri::command]
fn move_window(window: tauri::Window, x: f64, y: f64) -> Result<(), String> {
    window
        .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
            x: x as i32,
            y: y as i32,
        }))
        .map_err(|e| e.to_string())
}

/// Resize the companion window dynamically.
#[tauri::command]
fn resize_window(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: width as u32,
            height: height as u32,
        }))
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            toggle_visibility,
            move_window,
            resize_window,
        ])
        .setup(|app| {
            // Make the window transparent background work on macOS
            let window = app.get_webview_window("main").unwrap();
            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;
                let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
            }
            #[cfg(target_os = "windows")]
            {
                // On Windows, transparent + decorations:false is handled by Tauri.
                // The webview background transparency is controlled by the frontend CSS.
                // No additional native setup required for basic transparency.
                let _ = &window; // suppress unused warning
            }
            // Ensure window is ready
            let _ = window.show();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ClawBody");
}
