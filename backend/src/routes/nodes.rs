use axum::Json;
use axum::Router;
use axum::extract::State;
use axum::http::HeaderMap;
use axum::routing::get;
use serde_json::Value;

use crate::error::{AppError, require_api_key};
use crate::luraph::LuraphClient;
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new().route("/nodes", get(get_nodes))
}

async fn get_nodes(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    let api_key = require_api_key(&headers)?;
    let client = LuraphClient::new(state.http.clone(), state.luraph_base.clone());
    let nodes = client.get_nodes(&api_key).await?;
    Ok(Json(nodes))
}
