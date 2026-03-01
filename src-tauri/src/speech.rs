//! Native speech recognition for macOS via SFSpeechRecognizer.
//! On non-macOS platforms, all commands return graceful errors.

use std::sync::atomic::{AtomicBool, Ordering};
use tauri::Emitter;

#[cfg(target_os = "macos")]
mod native {
    use swift_rs::{swift, Bool, SRString};

    swift!(fn native_speech_available() -> Bool);
    swift!(fn native_speech_start(lang: &SRString));
    swift!(fn native_speech_stop());
    swift!(fn native_speech_poll() -> SRString);

    pub fn available() -> bool {
        unsafe { native_speech_available() }
    }

    pub fn start(lang: &str) {
        let sr_lang = SRString::from(lang);
        unsafe { native_speech_start(&sr_lang) };
    }

    pub fn stop() {
        unsafe { native_speech_stop() };
    }

    /// Returns (status, text, error)
    pub fn poll() -> (String, String, String) {
        let result = unsafe { native_speech_poll() };
        let s: &str = result.as_str();
        let mut parts = s.splitn(3, '|');
        let status = parts.next().unwrap_or("idle").to_string();
        let text = parts.next().unwrap_or("").to_string();
        let error = parts.next().unwrap_or("").to_string();
        (status, text, error)
    }
}

static POLLING: AtomicBool = AtomicBool::new(false);

#[tauri::command]
pub fn is_native_speech_available() -> bool {
    #[cfg(target_os = "macos")]
    {
        native::available()
    }
    #[cfg(not(target_os = "macos"))]
    {
        false
    }
}

#[tauri::command]
pub fn start_native_speech(app: tauri::AppHandle, lang: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        native::start(&lang);

        // Start polling thread if not already running
        if !POLLING.swap(true, Ordering::SeqCst) {
            let app_handle = app.clone();
            std::thread::spawn(move || {
                while POLLING.load(Ordering::SeqCst) {
                    std::thread::sleep(std::time::Duration::from_millis(100));

                    let (status, text, error) = native::poll();

                    let _ = app_handle.emit(
                        "native-speech-result",
                        serde_json::json!({
                            "status": status,
                            "text": text,
                            "error": error,
                        }),
                    );

                    if status == "final" || status == "error" {
                        POLLING.store(false, Ordering::SeqCst);
                        break;
                    }
                }
            });
        }

        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        let _ = lang;
        Err("Native speech recognition only available on macOS".into())
    }
}

#[tauri::command]
pub fn stop_native_speech() -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        POLLING.store(false, Ordering::SeqCst);
        native::stop();
        Ok(())
    }
    #[cfg(not(target_os = "macos"))]
    {
        Err("Native speech recognition only available on macOS".into())
    }
}
