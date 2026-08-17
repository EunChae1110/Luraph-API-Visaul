use axum::Json;
use axum::Router;
use axum::routing::get;
use chrono::Utc;
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    ok: bool,
    service: &'static str,
    version: &'static str,
    os: &'static str,
    arch: &'static str,
    timestamp: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReadyResponse {
    ready: bool,
    note: &'static str,
}

pub fn router() -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        ok: true,
        service: "luraph-api-visual-backend",
        version: env!("CARGO_PKG_VERSION"),
        os: std::env::consts::OS,
        arch: std::env::consts::ARCH,
        timestamp: Utc::now().to_rfc3339(),
    })
}

async fn ready() -> Json<ReadyResponse> {
    Json(ReadyResponse {
        ready: true,
        note: "Proxying Luraph API; job history stored in SQLite.",
    })
}
