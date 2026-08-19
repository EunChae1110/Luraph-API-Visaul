pub mod backup;
pub mod db;
pub mod error;
pub mod luraph;
pub mod routes;
pub mod state;

use std::future::Future;
use std::net::SocketAddr;
use std::path::PathBuf;

use axum::Router;
use axum::extract::DefaultBodyLimit;
use axum::http::HeaderValue;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};
use tower_http::trace::TraceLayer;

use crate::state::AppState;

pub const MAX_BODY_BYTES: usize = 55 * 1024 * 1024;
pub const DEFAULT_PORT: u16 = 8787;

#[derive(Debug, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub luraph_base: String,
    pub db_path: PathBuf,
    pub backup_dir: PathBuf,
    pub cors_origins: Vec<String>,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".into(),
            port: DEFAULT_PORT,
            luraph_base: "https://api.lura.ph/v1".into(),
            db_path: PathBuf::from("data/history.db"),
            backup_dir: PathBuf::from("data/backups"),
            cors_origins: vec![
                "http://localhost:3000".into(),
                "http://127.0.0.1:3000".into(),
                "tauri://localhost".into(),
                "http://tauri.localhost".into(),
                "https://tauri.localhost".into(),
            ],
        }
    }
}

impl ServerConfig {
    pub fn from_env() -> Self {
        let mut cfg = Self::default();
        if let Ok(host) = std::env::var("HOST") {
            cfg.host = host;
        }
        if let Ok(port) = std::env::var("PORT") {
            if let Ok(p) = port.parse() {
                cfg.port = p;
            }
        }
        if let Ok(base) = std::env::var("LURAPH_API_BASE") {
            cfg.luraph_base = base;
        }
        if let Ok(path) = std::env::var("DATABASE_PATH") {
            cfg.db_path = PathBuf::from(path);
        }
        if let Ok(path) = std::env::var("BACKUP_DIR") {
            cfg.backup_dir = PathBuf::from(path);
        }
        if let Ok(origins) = std::env::var("CORS_ORIGINS") {
            cfg.cors_origins = origins
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_string)
                .collect();
        }
        cfg
    }

    pub fn listen_addr(&self) -> SocketAddr {
        format!("{}:{}", self.host, self.port)
            .parse()
            .unwrap_or_else(|_| SocketAddr::from(([127, 0, 0, 1], self.port)))
    }
}

fn build_cors(origins: &[String]) -> CorsLayer {
    let parsed: Vec<HeaderValue> = origins
        .iter()
        .filter_map(|s| s.parse().ok())
        .collect();

    if parsed.is_empty() {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    } else {
        CorsLayer::new()
            .allow_origin(AllowOrigin::list(parsed))
            .allow_methods(Any)
            .allow_headers(Any)
    }
}

/// Run the HTTP API until `shutdown` completes.
pub async fn serve(
    config: ServerConfig,
    shutdown: impl Future<Output = ()> + Send + 'static,
) -> anyhow::Result<()> {
    let addr = config.listen_addr();
    let state = AppState::new(
        config.db_path.clone(),
        config.luraph_base.clone(),
        config.backup_dir.clone(),
    )?;

    let app = Router::new()
        .merge(routes::router(state))
        .layer(DefaultBodyLimit::max(MAX_BODY_BYTES))
        .layer(TraceLayer::new_for_http())
        .layer(build_cors(&config.cors_origins));

    tracing::info!(
        %addr,
        luraph_base = %config.luraph_base,
        db = %config.db_path.display(),
        backups = %config.backup_dir.display(),
        os = std::env::consts::OS,
        arch = std::env::consts::ARCH,
        "Luraph API Visual backend listening"
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown)
        .await?;
    Ok(())
}

pub async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }

    tracing::info!("shutdown signal received");
}
