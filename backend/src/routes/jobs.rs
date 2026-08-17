use std::path::Path;

use axum::Json;
use axum::Router;
use axum::body::Body;
use axum::extract::{Path as AxumPath, State};
use axum::http::{HeaderMap, HeaderValue, StatusCode, header};
use axum::response::Response;
use axum::routing::{get, post};
use serde::Deserialize;
use serde_json::{Value, json};

use crate::backup;
use crate::db::{self, HistoryJob};
use crate::error::{AppError, hash_api_key, require_api_key};
use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/jobs", get(list_jobs).post(create_job))
        .route("/jobs/{job_id}", get(get_job))
        .route("/jobs/{job_id}/status", post(poll_status))
        .route("/jobs/{job_id}/download", get(download_job))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateJobRequest {
    node: String,
    file_name: String,
    /// Raw script text (backend base64-encodes for Luraph).
    script: String,
    #[serde(default = "empty_object")]
    options: Value,
    #[serde(default)]
    use_tokens: bool,
    #[serde(default = "default_enforce")]
    enforce_settings: bool,
}

fn default_enforce() -> bool {
    true
}

fn empty_object() -> Value {
    json!({})
}

fn db_lock(state: &AppState) -> Result<std::sync::MutexGuard<'_, rusqlite::Connection>, AppError> {
    state.db.lock().map_err(|_| {
        AppError::new(StatusCode::INTERNAL_SERVER_ERROR, "Database lock poisoned")
    })
}

async fn list_jobs(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Value>, AppError> {
    let api_key = require_api_key(&headers)?;
    let key_hash = hash_api_key(&api_key);
    let conn = db_lock(&state)?;
    let jobs = db::list_jobs(&conn, &key_hash)?;
    Ok(Json(json!({ "jobs": jobs })))
}

async fn get_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Json<HistoryJob>, AppError> {
    let api_key = require_api_key(&headers)?;
    let key_hash = hash_api_key(&api_key);
    let conn = db_lock(&state)?;
    db::get_job(&conn, &key_hash, &job_id)?
        .map(Json)
        .ok_or_else(|| AppError::not_found("Job not found in local history"))
}

async fn create_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateJobRequest>,
) -> Result<(StatusCode, Json<HistoryJob>), AppError> {
    let api_key = require_api_key(&headers)?;
    let key_hash = hash_api_key(&api_key);

    if body.node.trim().is_empty() {
        return Err(AppError::new(StatusCode::BAD_REQUEST, "node is required"));
    }
    if body.file_name.trim().is_empty() {
        return Err(AppError::new(StatusCode::BAD_REQUEST, "fileName is required"));
    }
    if body.file_name.len() > 255 {
        return Err(AppError::new(
            StatusCode::BAD_REQUEST,
            "fileName must be at most 255 characters",
        ));
    }
    if body.script.is_empty() {
        return Err(AppError::new(StatusCode::BAD_REQUEST, "script is required"));
    }

    let client = state.client();
    let created = client
        .create_job(
            &api_key,
            body.node.trim(),
            &body.script,
            body.file_name.trim(),
            body.options.clone(),
            body.use_tokens,
            body.enforce_settings,
        )
        .await?;

    let job = HistoryJob {
        id: created.job_id.clone(),
        file_name: body.file_name.trim().to_string(),
        node_id: body.node.trim().to_string(),
        state: "queued".into(),
        created_at: db::now_rfc3339(),
        finished_at: None,
        error: None,
        result_file_name: None,
        use_tokens: body.use_tokens,
        local_path: None,
    };

    {
        let conn = db_lock(&state)?;
        db::insert_job(&conn, &key_hash, &job, &body.options)?;
    }

    // Persist queued job; client will auto-poll status + backup via /status.
    // (Avoid double-polling Luraph's 3-call limit with a parallel background task.)
    Ok((StatusCode::CREATED, Json(job)))
}

async fn poll_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Json<HistoryJob>, AppError> {
    let api_key = require_api_key(&headers)?;
    let key_hash = hash_api_key(&api_key);

    {
        let conn = db_lock(&state)?;
        if db::get_job(&conn, &key_hash, &job_id)?.is_some() {
            let _ = db::mark_running(&conn, &key_hash, &job_id);
        }
    }

    let client = state.client();
    let status = client.get_status(&api_key, &job_id).await?;

    if let Some(err) = status.error.filter(|e| !e.is_empty()) {
        let conn = db_lock(&state)?;
        if db::get_job(&conn, &key_hash, &job_id)?.is_none() {
            let job = HistoryJob {
                id: job_id.clone(),
                file_name: "unknown.lua".into(),
                node_id: "unknown".into(),
                state: "failed".into(),
                created_at: db::now_rfc3339(),
                finished_at: Some(db::now_rfc3339()),
                error: Some(err.clone()),
                result_file_name: None,
                use_tokens: false,
                local_path: None,
            };
            db::insert_job(&conn, &key_hash, &job, &json!({}))?;
            return Ok(Json(job));
        }
        db::update_job_result(&conn, &key_hash, &job_id, "failed", Some(&err), None, None)?;
        return db::get_job(&conn, &key_hash, &job_id)?
            .map(Json)
            .ok_or_else(|| AppError::not_found("Job not found after update"));
    }

    // Success → download + backup immediately
    let file = client.download(&api_key, &job_id).await?;
    let path = backup::write_backup(&state.backup_dir, &job_id, &file.file_name, &file.bytes)?;
    let path_str = path.display().to_string();

    let conn = db_lock(&state)?;
    if db::get_job(&conn, &key_hash, &job_id)?.is_none() {
        let job = HistoryJob {
            id: job_id.clone(),
            file_name: file.file_name.clone(),
            node_id: "unknown".into(),
            state: "done".into(),
            created_at: db::now_rfc3339(),
            finished_at: Some(db::now_rfc3339()),
            error: None,
            result_file_name: Some(file.file_name.clone()),
            use_tokens: false,
            local_path: Some(path_str.clone()),
        };
        db::insert_job(&conn, &key_hash, &job, &json!({}))?;
        return Ok(Json(job));
    }

    db::update_job_result(
        &conn,
        &key_hash,
        &job_id,
        "done",
        None,
        Some(&file.file_name),
        Some(&path_str),
    )?;

    db::get_job(&conn, &key_hash, &job_id)?
        .map(Json)
        .ok_or_else(|| AppError::not_found("Job not found after backup"))
}

async fn download_job(
    State(state): State<AppState>,
    headers: HeaderMap,
    AxumPath(job_id): AxumPath<String>,
) -> Result<Response, AppError> {
    let api_key = require_api_key(&headers)?;
    let key_hash = hash_api_key(&api_key);

    // Prefer local backup (survives Luraph 24h expiry)
    let local = {
        let conn = db_lock(&state)?;
        db::get_job(&conn, &key_hash, &job_id)?
    };

    if let Some(job) = local.as_ref() {
        if let Some(path) = job.local_path.as_deref() {
            if Path::new(path).is_file() {
                let bytes = backup::read_backup(path)?;
                let name = job
                    .result_file_name
                    .clone()
                    .unwrap_or_else(|| format!("{job_id}-obfuscated.lua"));
                return Ok(file_response(bytes, &name, "text/x-lua"));
            }
        }
    }

    let client = state.client();
    let file = client.download(&api_key, &job_id).await?;
    let path = backup::write_backup(&state.backup_dir, &job_id, &file.file_name, &file.bytes)?;
    let path_str = path.display().to_string();

    {
        let conn = db_lock(&state)?;
        let _ = db::update_job_result(
            &conn,
            &key_hash,
            &job_id,
            "done",
            None,
            Some(&file.file_name),
            Some(&path_str),
        );
    }

    Ok(file_response(file.bytes, &file.file_name, &file.content_type))
}

fn file_response(bytes: Vec<u8>, file_name: &str, content_type: &str) -> Response {
    let mut response = Response::new(Body::from(bytes));
    *response.status_mut() = StatusCode::OK;
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_str(content_type)
            .unwrap_or_else(|_| HeaderValue::from_static("text/x-lua")),
    );
    let disposition = format!(
        "attachment; filename=\"{}\"",
        file_name.replace('"', "")
    );
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&disposition)
            .unwrap_or_else(|_| HeaderValue::from_static("attachment")),
    );
    response
}
