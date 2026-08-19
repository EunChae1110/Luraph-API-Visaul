use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryJob {
    pub id: String,
    pub file_name: String,
    pub node_id: String,
    pub state: String,
    pub created_at: String,
    pub finished_at: Option<String>,
    pub error: Option<String>,
    pub result_file_name: Option<String>,
    pub use_tokens: bool,
    /// Absolute path to local backup (survives Luraph 24h expiry).
    pub local_path: Option<String>,
    /// Shared id when several files were submitted together. `None` for a single job.
    pub batch_id: Option<String>,
}

pub fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY NOT NULL,
            api_key_hash TEXT NOT NULL,
            file_name TEXT NOT NULL,
            node_id TEXT NOT NULL,
            state TEXT NOT NULL,
            created_at TEXT NOT NULL,
            finished_at TEXT,
            error TEXT,
            result_file_name TEXT,
            use_tokens INTEGER NOT NULL DEFAULT 0,
            options_json TEXT NOT NULL DEFAULT '{}',
            local_path TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_jobs_key_created
            ON jobs(api_key_hash, created_at DESC);
        "#,
    )?;
    ensure_column(
        conn,
        "jobs",
        "local_path",
        "ALTER TABLE jobs ADD COLUMN local_path TEXT",
    )?;
    ensure_column(
        conn,
        "jobs",
        "batch_id",
        "ALTER TABLE jobs ADD COLUMN batch_id TEXT",
    )?;
    Ok(())
}

fn ensure_column(
    conn: &Connection,
    table: &str,
    column: &str,
    ddl: &str,
) -> rusqlite::Result<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let names: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(|r| r.ok())
        .collect();
    if !names.iter().any(|n| n == column) {
        conn.execute(ddl, [])?;
    }
    Ok(())
}

fn map_job(row: &rusqlite::Row<'_>) -> rusqlite::Result<HistoryJob> {
    Ok(HistoryJob {
        id: row.get(0)?,
        file_name: row.get(1)?,
        node_id: row.get(2)?,
        state: row.get(3)?,
        created_at: row.get(4)?,
        finished_at: row.get(5)?,
        error: row.get(6)?,
        result_file_name: row.get(7)?,
        use_tokens: row.get::<_, i64>(8)? != 0,
        local_path: row.get(9)?,
        batch_id: row.get(10)?,
    })
}

const JOB_SELECT: &str = r#"
    SELECT id, file_name, node_id, state, created_at, finished_at,
           error, result_file_name, use_tokens, local_path, batch_id
    FROM jobs
"#;

pub fn insert_job(
    conn: &Connection,
    api_key_hash: &str,
    job: &HistoryJob,
    options: &Value,
) -> rusqlite::Result<()> {
    conn.execute(
        r#"
        INSERT INTO jobs (
            id, api_key_hash, file_name, node_id, state,
            created_at, finished_at, error, result_file_name, use_tokens,
            options_json, local_path, batch_id
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)
        "#,
        params![
            job.id,
            api_key_hash,
            job.file_name,
            job.node_id,
            job.state,
            job.created_at,
            job.finished_at,
            job.error,
            job.result_file_name,
            job.use_tokens as i64,
            options.to_string(),
            job.local_path,
            job.batch_id,
        ],
    )?;
    Ok(())
}

pub fn list_jobs(conn: &Connection, api_key_hash: &str) -> rusqlite::Result<Vec<HistoryJob>> {
    let mut stmt = conn.prepare(&format!(
        "{JOB_SELECT}
        WHERE api_key_hash = ?1
        ORDER BY created_at DESC
        LIMIT 500"
    ))?;

    let rows = stmt.query_map(params![api_key_hash], map_job)?;
    rows.collect()
}

pub fn get_job(
    conn: &Connection,
    api_key_hash: &str,
    job_id: &str,
) -> rusqlite::Result<Option<HistoryJob>> {
    conn.query_row(
        &format!("{JOB_SELECT} WHERE api_key_hash = ?1 AND id = ?2"),
        params![api_key_hash, job_id],
        map_job,
    )
    .optional()
}

pub fn update_job_result(
    conn: &Connection,
    api_key_hash: &str,
    job_id: &str,
    state: &str,
    error: Option<&str>,
    result_file_name: Option<&str>,
    local_path: Option<&str>,
) -> rusqlite::Result<usize> {
    let finished_at = Utc::now().to_rfc3339();
    conn.execute(
        r#"
        UPDATE jobs
        SET state = ?1,
            error = ?2,
            result_file_name = COALESCE(?3, result_file_name),
            local_path = COALESCE(?4, local_path),
            finished_at = ?5
        WHERE api_key_hash = ?6 AND id = ?7
        "#,
        params![
            state,
            error,
            result_file_name,
            local_path,
            finished_at,
            api_key_hash,
            job_id
        ],
    )
}

pub fn mark_running(conn: &Connection, api_key_hash: &str, job_id: &str) -> rusqlite::Result<usize> {
    conn.execute(
        r#"
        UPDATE jobs SET state = 'running'
        WHERE api_key_hash = ?1 AND id = ?2 AND state IN ('queued', 'running')
        "#,
        params![api_key_hash, job_id],
    )
}

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}
