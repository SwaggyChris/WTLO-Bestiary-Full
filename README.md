# WTLO Bestiary — Machine-Local Edition

A React/Vite WTLO Bestiary where persistent content is stored as **normal files inside the project folder**, not in browser local storage.

## What is persisted

| Content | Location |
| --- | --- |
| Bestiary entries | `storage/bestiary-state.json` |
| Species/categories and colors | `storage/bestiary-state.json` |
| Uploaded monster images | `storage/images/` |
| Automatic rolling backups | `storage/backups/` |
| Seed/default dataset | `src/data/bestiaryData.json` |

The app does **not** use `localStorage`, `sessionStorage`, or IndexedDB for bestiary persistence.

## Project structure

```text
WTLO-Bestiary-Full/
├─ public/
│  ├─ lib-assets/              # Existing built-in monster assets go here
│  └─ other assets/            # Existing logo/UI assets go here
├─ scripts/
│  ├─ backup-storage.mjs       # Manual JSON backup
│  ├─ reset-storage.mjs        # Reset current state to seed data
│  └─ storage-info.mjs         # Show local storage paths/counts
├─ server/
│  ├─ api.mjs                  # Local JSON/image API
│  ├─ fileStore.mjs            # Atomic writes + rolling backups
│  ├─ paths.mjs                # Central project/storage paths
│  └─ vitePlugin.mjs           # Connects API to Vite dev/preview
├─ src/
│  ├─ components/              # Reusable React UI pieces
│  ├─ data/                    # Seed bestiary dataset + image mapping
│  ├─ lib/                     # Bestiary data utilities
│  ├─ services/                # Frontend machine-storage API client
│  ├─ styles/                  # App CSS
│  ├─ App.jsx
│  └─ main.jsx
├─ storage/
│  ├─ backups/                 # Rolling backup snapshots
│  ├─ images/                  # Images uploaded from the UI
│  └─ bestiary-state.json      # Current persistent bestiary database
├─ index.html
├─ package.json
└─ vite.config.js
```

## Run

Requirements: Node.js 20.19+ or Node.js 22.12+.

```powershell
npm install
npm run dev
```

Open the local address shown by Vite, normally:

```text
http://127.0.0.1:5173
```

Do **not** open `index.html` directly with `file://`. Browsers cannot safely write arbitrary project files. The Vite local server provides the machine-local file API.

## Storage behavior

Every entry/category mutation is automatically written to `storage/bestiary-state.json`. The write is atomic: data is first written to a temporary file and then renamed into place. Before a state replacement, the current state is copied into `storage/backups/`. The newest 20 automatic/manual backups are retained.

Images selected in the entry editor are copied to `storage/images/`. Entries store an API path pointing to that local image. Replaced/deleted images are cleaned up, and unsaved temporary uploads are removed when the editor is canceled.

If the storage API is unavailable, the UI blocks editing instead of silently falling back to browser-only data.

## Useful commands

```powershell
npm run storage:info
npm run storage:backup
npm run storage:reset
npm run build
npm run preview
```

`storage:reset` creates a backup first, then restores the current database from `src/data/bestiaryData.json`.

## Existing WTLO assets

The code you supplied contains the monster image mapping, but the actual `lib-assets/mobs-db` and `other assets` image folders were not included in the uploaded project files. Copy your existing folders into `public/` using these paths:

```text
public/lib-assets/mobs-db/...
public/other assets/BossSkull.png
```

User-uploaded images do **not** need to be placed there; the application manages those automatically under `storage/images/`.
