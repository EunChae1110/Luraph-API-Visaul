use std::sync::Mutex;

use luraph_api_visual_backend::{DEFAULT_PORT, ServerConfig, serve};
use tauri::{Manager, RunEvent};
use tokio::sync::oneshot;
use tracing_subscriber::EnvFilter;

struct BackendShutdown(Mutex<Option<oneshot::Sender<()>>>);

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let _ = tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .try_init();

    let (shutdown_tx, shutdown_rx) = oneshot::channel::<()>();

    tauri::Builder::default()
        .manage(BackendShutdown(Mutex::new(Some(shutdown_tx))))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let data_dir = app
                .path()
                .app_data_dir()
                .expect("failed to resolve app data dir");
            std::fs::create_dir_all(&data_dir).expect("failed to create app data dir");

            let mut config = ServerConfig::default();
            config.db_path = data_dir.join("history.db");
            config.backup_dir = data_dir.join("backups");
            config.port = std::env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(DEFAULT_PORT);

            tracing::info!(
                data_dir = %data_dir.display(),
                port = config.port,
                "starting embedded Luraph backend"
            );

            tauri::async_runtime::spawn(async move {
                let shutdown = async move {
                    let _ = shutdown_rx.await;
                    tracing::info!("embedded backend shutdown requested");
                };
                if let Err(err) = serve(config, shutdown).await {
                    tracing::error!(error = %err, "embedded backend exited with error");
                }
            });

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let RunEvent::Exit = event {
                if let Some(state) = app_handle.try_state::<BackendShutdown>() {
                    if let Ok(mut guard) = state.0.lock() {
                        if let Some(tx) = guard.take() {
                            let _ = tx.send(());
                        }
                    }
                }
            }
        });
}
