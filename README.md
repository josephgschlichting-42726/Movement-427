# mōv

Offline-first workout tracker PWA for iPhone.

- [Product spec & build plan](docs/plan.md)
- [Style guide](docs/style-guide.md)

## Develop

```sh
npm install
npm run dev        # local dev server
npm run build      # typecheck + production build (dist/)
npm run preview    # serve the production build
npm run icons      # re-render app icons (needs Playwright/Chromium)
```

## Stack

Vite + React + TypeScript · vite-plugin-pwa (Workbox) · Dexie (IndexedDB) · hash routing.
Design tokens live in `src/styles/tokens.css` and follow `docs/style-guide.md`.

## Deploy

Every push to `main` or the working branch builds and publishes to the `gh-pages` branch
(`.github/workflows/deploy.yml`). One-time setup: **Settings → Pages → Deploy from a branch → `gh-pages` / root**.
The app is served at `https://<owner>.github.io/<repo>/`.
