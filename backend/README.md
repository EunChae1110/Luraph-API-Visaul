# Backend

Rust (Axum) crate shared by the Tauri app and a standalone binary. It proxies `https://api.lura.ph/v1`, stores per-key job history in SQLite, and writes obfuscated files to disk so downloads survive Luraph’s 24-hour expiry.

## Embedded (desktop)

`npm run app:dev` / `npm run app:build` from `frontend/` starts this server inside the app on `127.0.0.1:8787`. Database and backups go to the OS application data directory.

## Standalone

```bash
cd backend
cp .env.example .env   # optional
cargo run
```

Listens on `http://127.0.0.1:8787` with `data/history.db` and `data/backups/`.

Environment variables are documented in the [root README](../README.md#configuration). Routes are listed under [HTTP API](../README.md#http-api).
