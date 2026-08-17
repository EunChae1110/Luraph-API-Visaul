use luraph_api_visual_backend::{ServerConfig, serve, shutdown_signal};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() {
    let _ = dotenvy::dotenv();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let config = ServerConfig::from_env();
    if let Err(err) = serve(config, shutdown_signal()).await {
        panic!("server error: {err}");
    }
}
