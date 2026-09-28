# Machine-local bestiary storage

This folder is the persistent database for the local WTLO Bestiary.

- `bestiary-state.json` — current entries and species/categories.
- `images/` — images uploaded through the Bestiary UI.
- `backups/` — rolling JSON snapshots created before saves plus manual backups.

The application does not persist bestiary data in browser localStorage, sessionStorage or IndexedDB.
Do not delete this folder if you want to keep your local changes.
