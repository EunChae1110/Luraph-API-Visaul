use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

use crate::db;
use crate::luraph::LuraphClient;

#[derive(Clone)]
pub struct AppState {
    pub db: Arc<Mutex<Connection>>,
    pub luraph_base: String,
    pub backup_dir: PathBuf,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(
        db_path: PathBuf,
        luraph_base: String,
        backup_dir: PathBuf,
    ) -> anyhow::Result<Self> {
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::create_dir_all(&backup_dir)?;
        let conn = Connection::open(&db_path)?;
        db::migrate(&conn)?;
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(200))
            .build()?;
        Ok(Self {
            db: Arc::new(Mutex::new(conn)),
            luraph_base: luraph_base.trim_end_matches('/').to_string(),
            backup_dir,
            http,
        })
    }

    pub fn client(&self) -> LuraphClient {
        LuraphClient::new(self.http.clone(), self.luraph_base.clone())
    }
}
