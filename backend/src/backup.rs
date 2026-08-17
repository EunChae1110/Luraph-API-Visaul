use std::fs;
use std::path::{Path, PathBuf};

use crate::error::AppError;
use axum::http::StatusCode;

pub fn sanitize_file_name(name: &str) -> String {
    let trimmed = name.trim();
    let base = if trimmed.is_empty() {
        "script-obfuscated.lua"
    } else {
        trimmed
    };
    let cleaned: String = base
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || matches!(c, '.' | '-' | '_' ) {
                c
            } else {
                '_'
            }
        })
        .collect();
    if cleaned.is_empty() {
        "script-obfuscated.lua".into()
    } else {
        cleaned
    }
}

pub fn backup_path(backup_dir: &Path, job_id: &str, file_name: &str) -> PathBuf {
    backup_dir
        .join(sanitize_file_name(job_id))
        .join(sanitize_file_name(file_name))
}

pub fn write_backup(
    backup_dir: &Path,
    job_id: &str,
    file_name: &str,
    bytes: &[u8],
) -> Result<PathBuf, AppError> {
    let path = backup_path(backup_dir, job_id, file_name);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| {
            AppError::new(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Failed to create backup dir: {e}"),
            )
        })?;
    }
    fs::write(&path, bytes).map_err(|e| {
        AppError::new(
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Failed to write backup: {e}"),
        )
    })?;
    Ok(path)
}

pub fn read_backup(path: &str) -> Result<Vec<u8>, AppError> {
    fs::read(path).map_err(|e| {
        AppError::new(
            StatusCode::NOT_FOUND,
            format!("Local backup missing: {e}"),
        )
    })
}
