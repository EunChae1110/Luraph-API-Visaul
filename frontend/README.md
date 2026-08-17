# Luraph Console (frontend + desktop shell)

Next.js UI packaged as a **native app** with Tauri 2 (Windows + macOS).

## Desktop app (what you want)

```bash
cd frontend
npm install
npm run app:dev
```

Opens a native window titled **Luraph Console**.

Build installers:

```bash
npm run app:build
```

## Web-only (optional)

```bash
npm run dev
```

Only needed for browser debugging — production target is the Tauri app.
