use base64::Engine;
use reqwest::header::{CONTENT_DISPOSITION, CONTENT_TYPE, HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum LuraphError {
    #[error("{message}")]
    Api {
        status: u16,
        message: String,
        body: Value,
    },
    #[error(transparent)]
    Http(#[from] reqwest::Error),
    #[error("invalid response: {0}")]
    Invalid(String),
}

#[derive(Debug, Deserialize)]
struct ErrorBody {
    errors: Option<Vec<ErrorItem>>,
}

#[derive(Debug, Deserialize)]
struct ErrorItem {
    param: Option<String>,
    message: String,
}

#[derive(Clone)]
pub struct LuraphClient {
    http: reqwest::Client,
    base: String,
}

impl LuraphClient {
    pub fn new(http: reqwest::Client, base: String) -> Self {
        Self {
            http,
            base: base.trim_end_matches('/').to_string(),
        }
    }

    fn url(&self, path: &str) -> String {
        format!("{}/{}", self.base, path.trim_start_matches('/'))
    }

    fn headers(api_key: &str) -> HeaderMap {
        let mut headers = HeaderMap::new();
        headers.insert(
            "Luraph-API-Key",
            HeaderValue::from_str(api_key).unwrap_or_else(|_| HeaderValue::from_static("")),
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers
    }

    async fn parse_json(resp: reqwest::Response) -> Result<Value, LuraphError> {
        let status = resp.status();
        let raw = resp.text().await.unwrap_or_default();
        let body: Value = if raw.trim().is_empty() {
            Value::Object(Default::default())
        } else {
            serde_json::from_str(&raw).unwrap_or_else(|_| Value::String(raw.clone()))
        };

        if status.is_success() {
            return Ok(body);
        }

        let message = if let Ok(err) = serde_json::from_value::<ErrorBody>(body.clone()) {
            err.errors
                .unwrap_or_default()
                .into_iter()
                .map(|e| match e.param {
                    Some(p) => format!("{p}: {}", e.message),
                    None => e.message,
                })
                .collect::<Vec<_>>()
                .join(" | ")
        } else {
            body.to_string()
        };

        let message = if message.is_empty() {
            format!("Luraph API error ({status})")
        } else {
            message
        };

        Err(LuraphError::Api {
            status: status.as_u16(),
            message,
            body,
        })
    }

    pub async fn get_nodes(&self, api_key: &str) -> Result<Value, LuraphError> {
        let resp = self
            .http
            .get(self.url("obfuscate/nodes"))
            .headers(Self::headers(api_key))
            .send()
            .await?;
        Self::parse_json(resp).await
    }

    pub async fn create_job(
        &self,
        api_key: &str,
        node: &str,
        script_raw: &str,
        file_name: &str,
        options: Value,
        use_tokens: bool,
        enforce_settings: bool,
    ) -> Result<CreateJobResponse, LuraphError> {
        let script = base64::engine::general_purpose::STANDARD.encode(script_raw.as_bytes());
        let body = serde_json::json!({
            "node": node,
            "script": script,
            "fileName": file_name,
            "options": options,
            "useTokens": use_tokens,
            "enforceSettings": enforce_settings,
        });

        let resp = self
            .http
            .post(self.url("obfuscate/new"))
            .headers(Self::headers(api_key))
            .json(&body)
            .send()
            .await?;
        let value = Self::parse_json(resp).await?;
        serde_json::from_value(value).map_err(|e| LuraphError::Invalid(e.to_string()))
    }

    pub async fn get_status(&self, api_key: &str, job_id: &str) -> Result<StatusResponse, LuraphError> {
        let resp = self
            .http
            .get(self.url(&format!("obfuscate/status/{job_id}")))
            .headers(Self::headers(api_key))
            .send()
            .await?;
        let value = Self::parse_json(resp).await?;
        serde_json::from_value(value).map_err(|e| LuraphError::Invalid(e.to_string()))
    }

    pub async fn download(
        &self,
        api_key: &str,
        job_id: &str,
    ) -> Result<DownloadResult, LuraphError> {
        let resp = self
            .http
            .get(self.url(&format!("obfuscate/download/{job_id}")))
            .header(
                "Luraph-API-Key",
                HeaderValue::from_str(api_key).unwrap_or_else(|_| HeaderValue::from_static("")),
            )
            .send()
            .await?;

        if !resp.status().is_success() {
            return Err(Self::parse_json(resp).await.unwrap_err());
        }

        let disposition = resp
            .headers()
            .get(CONTENT_DISPOSITION)
            .and_then(|v| v.to_str().ok())
            .map(str::to_string);
        let content_type = resp
            .headers()
            .get(CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("text/x-lua")
            .to_string();
        let bytes = resp.bytes().await?;
        let file_name = disposition
            .as_deref()
            .and_then(parse_filename)
            .unwrap_or_else(|| "script-obfuscated.lua".into());

        Ok(DownloadResult {
            file_name,
            content_type,
            bytes: bytes.to_vec(),
        })
    }
}

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJobResponse {
    pub job_id: String,
}

#[derive(Debug, Deserialize, Serialize)]
pub struct StatusResponse {
    pub error: Option<String>,
}

pub struct DownloadResult {
    pub file_name: String,
    pub content_type: String,
    pub bytes: Vec<u8>,
}

fn parse_filename(disposition: &str) -> Option<String> {
    // filename="..." or filename*=UTF-8''...
    for part in disposition.split(';') {
        let part = part.trim();
        if let Some(rest) = part.strip_prefix("filename*=") {
            let decoded = rest.split("''").nth(1).unwrap_or(rest);
            return Some(decoded.trim_matches('"').to_string());
        }
        if let Some(rest) = part.strip_prefix("filename=") {
            return Some(rest.trim_matches('"').to_string());
        }
    }
    None
}
