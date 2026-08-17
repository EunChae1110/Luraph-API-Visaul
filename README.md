# Luraph API Visual

Native desktop console for the [Luraph API](https://lura.ph/dashboard/documents/apidoc) (**Windows + macOS** via Tauri).

| Dir | Role |
|-----|------|
| `frontend/` | Next.js UI + Tauri shell |
| `backend/` | Rust proxy to `api.lura.ph` + **SQLite** job history |

## Run (dev)

Terminal 1 — backend:

```bash
cd backend
cargo run
```

Terminal 2 — desktop app (or web):

```bash
cd frontend
npm install
npm run app:dev   # native window
# or: npm run dev  # browser only
```

Sign in with your Luraph API key. History is stored in `backend/data/history.db` (scoped per key hash). Finished jobs are downloaded to `backend/data/backups/{jobId}/` and the path is saved in SQLite so results survive Luraph’s 24h expiry.

After `createNewJob`, the backend **auto-follows** status (up to 3 polls), backs up the file, and the History page **auto-refreshes** while jobs are queued/running.

## API surface (backend)

- `GET /api/v1/nodes` → Luraph `GET /obfuscate/nodes`
- `POST /api/v1/jobs` → Luraph `POST /obfuscate/new` + SQLite insert
- `POST /api/v1/jobs/{id}/status` → Luraph status (blocking) + SQLite update
- `GET /api/v1/jobs/{id}/download` → Luraph download
- `GET /api/v1/jobs` → SQLite list

Header: `Luraph-API-Key: <key>`
