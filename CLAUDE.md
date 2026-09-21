# CLAUDE.md

## Stack

- Vite + React + TypeScript + Mantine (frontend, `src/`)
- Fastify + better-sqlite3 (API + static serving, `server/`), single
  container serves both — no separate reverse proxy needed by the app
  itself
- SQLite at `$DATA_DIR/app.db` (default `/data`), mounted volume in prod

## Commands

- `npm run dev` — Vite dev server (5173) + API (3001) with hot reload,
  Vite proxies `/api/*` to the API
- `npm run build` — build SPA (`dist/`) and server (`server/dist/`)
- `npm start` — run the built server (production entrypoint)
- `npm run migrate` — apply pending migrations standalone, without
  starting the server
- `npm run typecheck` — typecheck both frontend and server configs
- `npm run lint` / `npm run format` — ESLint / Prettier. ESLint only
  covers plain `.js`/`.mjs` config files for now — `typescript-eslint`
  hard-blocks TypeScript 7 (which this template pins) at runtime, not
  just an unbumped peer range. `.ts`/`.tsx` files rely on `typecheck`
  for now; revisit once
  https://github.com/typescript-eslint/typescript-eslint/issues/10940
  ships TS7 support.

## Conventions

- **Migrations**: date-prefixed `.sql` files in `server/migrations/`
  (`2026-09-20.1_init.sql`, `2026-09-21.1_...sql`), applied in
  date-then-counter order, tracked in a `_migrations` table alongside a
  checksum of each file — editing an already-applied migration fails
  loudly instead of silently no-opping. Forward-only — no
  down-migrations. Applied
  automatically on server startup (`runMigrations()` in
  `server/index.ts`), and can also be run standalone via `npm run
migrate`.
- **Shared code**: `shared/` holds types and pure logic used by both
  `src/` and `server/` — keep it isomorphic (no DOM, no Node APIs) so
  both tsconfigs can include it.
- **Mantine theme** lives in `src/theme.ts` — extend it, don't override
  component styles inline, so apps built from this template stay
  visually consistent without copy-pasting overrides everywhere.
- **API routes** live under `/api/*` in `server/index.ts`; everything
  else falls through to the built SPA's `index.html` (client-side
  routing friendly).
- **Config**: `$CONFIG_DIR/.env` (default `/config/.env`) is loaded on
  startup via `dotenv`. Real environment variables (e.g.
  docker-compose `environment:`) always take precedence over the file
  — `dotenv` does not overwrite variables already set in `process.env`.
  Default config files ship in `config-defaults/` and are seeded into
  `$CONFIG_DIR` on first container start only; existing files there
  are never overwritten.
- **Never commit** `./data/` or `./config/` (gitignored) — local
  SQLite file and local config overrides.

## Docker / deploy

- Non-root runtime user (`app`, uid/gid 1000 by default); `PUID`/`PGID`
  env vars remap it to match the host at container start, so files
  written into mounted volumes have explicit, predictable ownership on
  Linux hosts. This remap requires starting the container as root —
  it's the right default for homelab bind mounts, but it's incompatible
  with rootless Docker or Kubernetes `runAsNonRoot`. The entrypoint
  detects a non-root start and skips the remap rather than failing, but
  PUID/PGID simply won't apply in that case.
- `better-sqlite3` is a native addon, but ships prebuilt bindings for
  Alpine/musl — the runtime stage runs a smoke test after install
  (`node -e "new require('better-sqlite3')(...)"`) so a build that
  can't load the binding fails at image-build time, not on the first
  request. No compiler toolchain is installed in either stage; if a
  future dependency bump ever needs one, that smoke test is the signal.
- The runtime stage does a fresh `npm ci --omit=dev` rather than
  copying `node_modules` across stages, so dev dependencies never end
  up in the shipped image.
- `HEALTHCHECK` hits `/api/health`, which also does a cheap `SELECT 1`
  against SQLite — so a wedged/locked db file fails the check too, not
  just process liveness.
- **No authentication by default.** Every route is open. Gating access
  (reverse-proxy auth, VPN/tailnet, forward-auth middleware, etc.) is
  the deploying environment's responsibility, not this app's. Don't
  assume any endpoint is protected.
- **No reverse proxy baked in.** The container just publishes its
  port (`3000` by default); whatever sits in front of it (Traefik or
  otherwise) is a deployment-time decision, not a template concern.
- Images publish to `ghcr.io/<owner>/<repo>` on every push to `main`
  (see `.github/workflows/publish.yml`), private by default.
- **Backups are the deployment's responsibility**, not this template's
  — `$DATA_DIR` is just a mounted volume; whatever backs up that host
  path is out of scope here. Because SQLite runs in WAL mode, back it
  up with `sqlite3 app.db ".backup ..."` or `VACUUM INTO`, not a raw
  `cp` of `app.db` while the container is running — a plain copy can
  miss the `-wal`/`-shm` files and land on a torn state.
