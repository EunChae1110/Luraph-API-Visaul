# Luraph API Visual — Backend

Rust (Axum) library used by the **Tauri app** (embedded) and as a standalone binary.

## Embedded (normal)

`npm run app:dev` / `npm run app:build` starts this server inside the desktop app on `127.0.0.1:8787`. Data goes to the OS app data directory.

## Standalone (optional)

```bash
cd backend
cargo run
```

Default: `http://127.0.0.1:8787` with `data/history.db` + `data/backups/`.

See root `README.md` for API routes.
