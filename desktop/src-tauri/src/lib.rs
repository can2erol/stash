use std::sync::Mutex;

use keyring::Entry;
use tauri::{Manager, RunEvent};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

// Keychain coordinates. The service mirrors the bundle identifier so the
// credential is clearly attributable in Keychain Access.
const KEYRING_SERVICE: &str = "com.stash.app";
const KEYRING_USER: &str = "anthropic-api-key";

/// Holds the spawned Python backend so we can stop it when the app quits.
struct Backend(Mutex<Option<CommandChild>>);

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_USER).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_api_key(key: String) -> Result<(), String> {
    keyring_entry()?.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_api_key() -> Result<Option<String>, String> {
    match keyring_entry()?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_api_key() -> Result<(), String> {
    match keyring_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Launch the bundled Python backend as a sidecar.
///
/// Best-effort: in development the sidecar binary may not be built, in which
/// case the developer is expected to run `uvicorn` manually. We log and carry
/// on so the app still opens (the UI surfaces a "connecting" state).
fn spawn_backend(app: &tauri::AppHandle) -> Option<CommandChild> {
    let data_dir = match app.path().app_data_dir() {
        Ok(dir) => dir,
        Err(e) => {
            log::error!("could not resolve app data dir: {e}");
            return None;
        }
    };
    if let Err(e) = std::fs::create_dir_all(&data_dir) {
        log::error!("could not create app data dir: {e}");
        return None;
    }

    let sidecar = match app.shell().sidecar("stash-backend") {
        Ok(cmd) => cmd.env("STASH_DATA_DIR", data_dir.to_string_lossy().to_string()),
        Err(e) => {
            log::warn!("backend sidecar unavailable ({e}); falling back to an external backend on :8000");
            return None;
        }
    };

    match sidecar.spawn() {
        Ok((mut rx, child)) => {
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) | CommandEvent::Stderr(line) => {
                            log::info!("[backend] {}", String::from_utf8_lossy(&line).trim_end());
                        }
                        CommandEvent::Terminated(payload) => {
                            log::warn!("[backend] exited: {:?}", payload);
                        }
                        _ => {}
                    }
                }
            });
            Some(child)
        }
        Err(e) => {
            log::error!("failed to start backend sidecar: {e}");
            None
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Backend(Mutex::new(None)))
        .invoke_handler(tauri::generate_handler![
            save_api_key,
            get_api_key,
            delete_api_key
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let child = spawn_backend(app.handle());
            *app.state::<Backend>().0.lock().unwrap() = child;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            // Make sure the backend doesn't outlive the window.
            if let RunEvent::ExitRequested { .. } = event {
                if let Some(child) = app.state::<Backend>().0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        });
}
