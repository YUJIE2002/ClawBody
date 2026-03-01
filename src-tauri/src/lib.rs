//! ClawBody — Tauri backend
//!
//! Handles native window management, system tray, config persistence,
//! model management, and bridges the frontend VRM renderer to the
//! OpenClaw agent framework.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::ipc::Response;
use tauri::Manager;

// ── Config ──────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub model_path: String,
    pub gateway_url: String,
    pub gateway_token: String,
    pub window_width: u32,
    pub window_height: u32,
    pub opacity: f64,
    pub always_on_top: bool,
    pub character_scale: f64,
    pub auto_reconnect: bool,
    // Pose & Animation
    #[serde(default)]
    pub pose: PoseConfig,
    #[serde(default)]
    pub animation: AnimationConfig,
    #[serde(default)]
    pub camera: CameraViewConfig,
    // Voice & Camera
    #[serde(default)]
    pub voice_input_enabled: bool,
    #[serde(default)]
    pub voice_output_enabled: bool,
    #[serde(default)]
    pub camera_enabled: bool,
    #[serde(default)]
    pub tts_voice_name: String,
    #[serde(default = "default_tts_rate")]
    pub tts_rate: f64,
    #[serde(default = "default_tts_pitch")]
    pub tts_pitch: f64,
    #[serde(default = "default_stt_language")]
    pub stt_language: String,
    #[serde(default)]
    pub auto_send_voice: bool,
    // Wake word
    #[serde(default)]
    pub wake_word_enabled: bool,
    #[serde(default = "default_wake_word")]
    pub wake_word: String,
    #[serde(default = "default_wake_word_lang")]
    pub wake_word_lang: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PoseConfig {
    #[serde(default = "default_arm_down")]
    pub arm_down: f64,
    #[serde(default = "default_elbow_bend")]
    pub elbow_bend: f64,
}

fn default_arm_down() -> f64 { 63.0 }
fn default_elbow_bend() -> f64 { 8.0 }

impl Default for PoseConfig {
    fn default() -> Self {
        Self { arm_down: 63.0, elbow_bend: 8.0 }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AnimationConfig {
    #[serde(default = "default_breathing_intensity")]
    pub breathing_intensity: f64,
    #[serde(default = "default_head_sway_intensity")]
    pub head_sway_intensity: f64,
    #[serde(default = "default_animation_speed")]
    pub animation_speed: f64,
}

fn default_breathing_intensity() -> f64 { 30.0 }
fn default_head_sway_intensity() -> f64 { 30.0 }
fn default_animation_speed() -> f64 { 1.0 }

impl Default for AnimationConfig {
    fn default() -> Self {
        Self {
            breathing_intensity: 30.0,
            head_sway_intensity: 30.0,
            animation_speed: 1.0,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CameraViewConfig {
    #[serde(default = "default_camera_height")]
    pub camera_height: f64,
    #[serde(default = "default_camera_distance")]
    pub camera_distance: f64,
    #[serde(default = "default_look_at_height")]
    pub look_at_height: f64,
    #[serde(default = "default_fov")]
    pub fov: f64,
}

fn default_camera_height() -> f64 { 1.25 }
fn default_camera_distance() -> f64 { 2.8 }
fn default_look_at_height() -> f64 { 1.15 }
fn default_fov() -> f64 { 28.0 }

impl Default for CameraViewConfig {
    fn default() -> Self {
        Self {
            camera_height: 1.25,
            camera_distance: 2.8,
            look_at_height: 1.15,
            fov: 28.0,
        }
    }
}

fn default_tts_rate() -> f64 { 1.0 }
fn default_tts_pitch() -> f64 { 1.0 }
fn default_stt_language() -> String { "zh-CN".to_string() }
fn default_wake_word() -> String { "顾衍".to_string() }
fn default_wake_word_lang() -> String { "zh-CN".to_string() }

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            model_path: String::new(),
            gateway_url: "ws://localhost:18789".to_string(),
            gateway_token: String::new(),
            window_width: 400,
            window_height: 600,
            opacity: 1.0,
            always_on_top: true,
            character_scale: 1.0,
            auto_reconnect: true,
            pose: PoseConfig::default(),
            animation: AnimationConfig::default(),
            camera: CameraViewConfig::default(),
            voice_input_enabled: false,
            voice_output_enabled: false,
            camera_enabled: false,
            tts_voice_name: String::new(),
            tts_rate: 1.0,
            tts_pitch: 1.0,
            stt_language: "zh-CN".to_string(),
            auto_send_voice: false,
            wake_word_enabled: false,
            wake_word: "顾衍".to_string(),
            wake_word_lang: "zh-CN".to_string(),
        }
    }
}

fn config_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("config.json"))
}

fn models_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("models");
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

// ── Commands: Config ────────────────────────────────────────────────

#[tauri::command]
fn get_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let path = config_path(&app)?;
    if path.exists() {
        let data = fs::read_to_string(&path).map_err(|e| e.to_string())?;
        serde_json::from_str(&data).map_err(|e| e.to_string())
    } else {
        let config = AppConfig::default();
        let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
        fs::write(&path, json).map_err(|e| e.to_string())?;
        Ok(config)
    }
}

#[tauri::command]
fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let path = config_path(&app)?;
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

// ── Commands: Model management ──────────────────────────────────────

#[tauri::command]
fn copy_model(app: tauri::AppHandle, source_path: String) -> Result<String, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source file not found: {}", source_path));
    }
    let filename = source
        .file_name()
        .ok_or("Invalid file name")?
        .to_string_lossy()
        .to_string();
    let dest = models_dir(&app)?.join(&filename);
    fs::copy(&source, &dest).map_err(|e| e.to_string())?;
    Ok(filename)
}

#[tauri::command]
fn list_models(app: tauri::AppHandle) -> Result<Vec<String>, String> {
    let dir = models_dir(&app)?;
    let mut models = Vec::new();
    for entry in fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path
            .extension()
            .map_or(false, |ext| ext.eq_ignore_ascii_case("vrm"))
        {
            if let Some(name) = path.file_name() {
                models.push(name.to_string_lossy().to_string());
            }
        }
    }
    models.sort();
    Ok(models)
}

/// Read a model file from the app data models directory.
/// Returns raw bytes for efficient binary transfer.
#[tauri::command]
fn read_model_file(app: tauri::AppHandle, filename: String) -> Result<Response, String> {
    let path = models_dir(&app)?.join(&filename);
    if !path.exists() {
        return Err(format!("Model not found: {}", filename));
    }
    let data = fs::read(&path).map_err(|e| e.to_string())?;
    Ok(Response::new(data))
}

#[tauri::command]
fn delete_model(app: tauri::AppHandle, filename: String) -> Result<(), String> {
    let path = models_dir(&app)?.join(&filename);
    if path.exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())
    } else {
        Err(format!("Model not found: {}", filename))
    }
}

// ── Commands: Window management ─────────────────────────────────────

// Settings panel is now rendered as an overlay in the main window — no separate window needed.

/// Toggle main window visibility (for system tray / context menu).
#[tauri::command]
fn toggle_visibility(app: tauri::AppHandle) -> Result<(), String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    if window.is_visible().unwrap_or(false) {
        window.hide().map_err(|e| e.to_string())?;
    } else {
        window.show().map_err(|e| e.to_string())?;
        window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Toggle always-on-top for the main window.
#[tauri::command]
fn toggle_always_on_top(app: tauri::AppHandle) -> Result<bool, String> {
    let window = app
        .get_webview_window("main")
        .ok_or("Main window not found")?;
    let current = window.is_always_on_top().map_err(|e| e.to_string())?;
    window
        .set_always_on_top(!current)
        .map_err(|e| e.to_string())?;
    Ok(!current)
}

/// Move the companion window to a specific position.
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

/// Quit the application.
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// ── App entry ───────────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            // Config
            get_config,
            save_config,
            // Models
            copy_model,
            list_models,
            read_model_file,
            delete_model,
            // Window
            toggle_visibility,
            toggle_always_on_top,
            move_window,
            resize_window,
            quit_app,
        ])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            // Apply saved config on startup
            if let Ok(dir) = app.path().app_data_dir() {
                let cfg_path = dir.join("config.json");
                if cfg_path.exists() {
                    if let Ok(data) = fs::read_to_string(&cfg_path) {
                        if let Ok(config) = serde_json::from_str::<AppConfig>(&data) {
                            let _ = window.set_size(tauri::Size::Physical(
                                tauri::PhysicalSize {
                                    width: config.window_width,
                                    height: config.window_height,
                                },
                            ));
                            let _ = window.set_always_on_top(config.always_on_top);
                        }
                    }
                }
            }

            #[cfg(target_os = "macos")]
            {
                use tauri::TitleBarStyle;
                let _ = window.set_title_bar_style(TitleBarStyle::Overlay);
            }

            let _ = window.show();
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ClawBody");
}
