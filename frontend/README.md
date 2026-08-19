# Frontend

Next.js 16 UI packaged as a native app with Tauri 2 (**Windows** and **macOS**). Product name: **Luraph Console**.

| Route | Page |
|-------|------|
| `/dashboard` | Nodes and create job |
| `/history` | Job history |
| `/config` | Node option presets |
| `/settings` | API key and backend URL |

## Desktop (recommended)

```bash
cd frontend
npm install
npm run app:dev
```

The Tauri shell embeds the backend crate and opens a native window. Production installers:

```bash
npm run app:build
```

Output: `src-tauri/target/release/bundle/`.

## Browser only

```bash
npm run dev
```

Requires the [standalone backend](../backend/README.md) on `http://127.0.0.1:8787`. Use this for UI debugging; the production target is the Tauri app.

Full setup, configuration, and API notes live in the [root README](../README.md).
