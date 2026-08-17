use axum::Json;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use serde::Serialize;
use serde_json::{Value, json};
use sha2::{Digest, Sha256};

use crate::luraph::LuraphError;

#[derive(Debug)]
pub struct AppError {
    pub status: StatusCode,
    pub message: String,
}

impl AppError {
    pub fn new(status: StatusCode, message: impl Into<String>) -> Self {
        Self {
            status,
            message: message.into(),
        }
    }

    pub fn unauthorized() -> Self {
        Self::new(
            StatusCode::UNAUTHORIZED,
            "Missing or invalid Luraph-API-Key header",
        )
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(StatusCode::NOT_FOUND, message)
    }
}

impl From<LuraphError> for AppError {
    fn from(err: LuraphError) -> Self {
        match err {
            LuraphError::Api { status, message, .. } => Self {
                status: StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY),
                message,
            },
            LuraphError::Http(e) => Self::new(
                StatusCode::BAD_GATEWAY,
                format!("Upstream request failed: {e}"),
            ),
            LuraphError::Invalid(e) => Self::new(StatusCode::BAD_GATEWAY, e),
        }
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        tracing::error!(error = %err, "sqlite error");
        Self::new(StatusCode::INTERNAL_SERVER_ERROR, "Database error")
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ErrorResponse {
    message: String,
    errors: Vec<Value>,
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let payload = ErrorResponse {
            message: self.message.clone(),
            errors: vec![json!({ "message": self.message })],
        };
        (self.status, Json(payload)).into_response()
    }
}

pub fn require_api_key(headers: &HeaderMap) -> Result<String, AppError> {
    headers
        .get("Luraph-API-Key")
        .or_else(|| headers.get("luraph-api-key"))
        .or_else(|| headers.get("x-api-key"))
        .and_then(|v| v.to_str().ok())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(str::to_string)
        .ok_or_else(AppError::unauthorized)
}

pub fn hash_api_key(api_key: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(api_key.as_bytes());
    hex::encode(hasher.finalize())
}
