# CLAUDE.md

## Stack

- Vite + React + TypeScript + Mantine (frontend, `src/`), TanStack
  Query for all server state, `@mantine/form` for the task form,
  `@mantine/notifications` for the done/undo toast
- Fastify + better-sqlite3 (API + static serving, `server/`), single
  container serves both — no separate reverse proxy needed by the app
  itself
- `shared/` holds types, zod schemas, and pure logic (urgency scoring,
  duration conversion) used by both `src/` and `server/`
- SQLite at `$DATA_DIR/time-since.db` (default `/data`), mounted
  volume in prod

## Commands

- `npm run dev` — Vite dev server (5173) + API (3001) with hot reload,
  against `./data/dev`; Vite proxies `/api/*` to the API
- `npm run seed` — insert a dozen realistic tasks (spread across all
  four bands, with backdated completion histories) into `./data/dev`;
  idempotent, skips if any tasks already exist
- `npm run build` — build SPA (`dist/`) and server (`server/dist/`)
- `npm start` — run the built server (production entrypoint); needs
  `DATA_DIR` passed explicitly (no compose `environment:` supplying it
  outside a container)
- `npm run migrate` — apply pending migrations standalone, without
  starting the server
- `npm run typecheck` — typecheck both frontend and server configs
- `npm run lint` / `npm run format` — ESLint / Prettier. TypeScript is
  held at `^6.0.3` (not the `^7` this template originally pinned) so
  that `typescript-eslint` — which hard-blocks TS7 at runtime — can
  lint `.ts`/`.tsx` files, which is what lets two `no-restricted-imports`
  rules mechanically enforce the traps below. Revisit once
  https://github.com/typescript-eslint/typescript-eslint/issues/10940
  ships TS7 support.
- `npm test` — Vitest across three projects: `frontend` (jsdom),
  `server` (node, temp-file SQLite per test file), `shared` (node,
  pure — no database access)

## Invariants

These are load-bearing; don't casually change them.

- **Urgency is computed client-side**, in `shared/urgency.ts`, at
  render time. The server stores and returns raw timestamps and
  thresholds only — no API response ever carries a `score` or `band`.
  This is what makes the list re-rank itself live in an open tab with
  no polling.
- **Sorting is client-side by necessity, not oversight** — the sort
  key (`urgencyScore`) depends on `now`, so it can't live in SQL.
  Text search is client-side too; the dataset is small (a few hundred
  rows at most).
- **All timestamps are epoch ms UTC; all durations are integer
  seconds.** Local time exists only in browser-side formatting code
  (`shared/duration.ts`'s `formatElapsed`).
- **`tasks` has no `last_completed_at` column** — it's always
  `MAX(completed_at)` over `completions`, computed at read time in
  `server/tasks.repo.ts`. The completion log is the source of truth.
- **Migrations are append-only and never edited after commit** — the
  `_migrations` table's checksum enforces it (throws on mismatch).
- **All SQL lives in `server/tasks.repo.ts`.** Routes don't contain
  SQL, and it's the one place camelCase (API) ↔ snake_case (db)
  mapping happens.
- **`shared/` never imports server code or Node builtins** — an
  ESLint `no-restricted-imports` override on `shared/**` and `src/**`
  enforces it (bans `better-sqlite3`, `node:*`, `fs`, `path`,
  `**/server/*`). `shared/` is bundled into the client; a Node import
  there would only fail at runtime in the browser, silently, without
  this rule.
- **Relative imports in `shared/` and `server/` carry explicit `.js`
  extensions** (NodeNext resolution) — `tsc -p server/tsconfig.json`
  fails without them even though Vite/Vitest don't care.
- **`server/index.ts` imports `./migrate.js`, `./app.js`, `./db.js`
  dynamically**, so they evaluate after `dotenv.config()` runs — a
  static import would be hoisted above it, making `DATA_DIR` from
  `$CONFIG_DIR/.env` silently ineffective. An ESLint
  `no-restricted-imports` override scoped to that one file enforces
  it.
- **The `db` handle is a module-scope singleton** (`server/db.ts`),
  created from `process.env.DATA_DIR` at import time. Tests isolate
  with a temp `DATA_DIR` set _before_ dynamically importing
  `./db.js`/`./migrate.js`/`./app.js` — a static import would be
  hoisted above the env assignment. One database per test _file_
  (Vitest's module registry is fresh per file, not per test case).

## Conventions

- **Migrations**: date-prefixed `.sql` files in `server/migrations/`
  (`2026-09-21.1_init.sql`), applied in date-then-counter order,
  tracked in a `_migrations` table alongside a checksum of each file.
  Forward-only — no down-migrations. Applied automatically on server
  startup (`runMigrations()`), and can also be run standalone via
  `npm run migrate`.
- **Mantine theme** lives in `src/theme.ts` — extend it, don't
  override component styles inline. It also exports `bandColor`, the
  one place a task band maps to a Mantine color.
- **API routes** live under `/api/*`, registered via
  `registerTaskRoutes()` in `server/routes/tasks.ts` and wired into
  `buildApp()` in `server/app.ts`; everything else falls through to
  the built SPA's `index.html`. Validation errors and thrown
  `HttpError`s (`server/http-errors.ts`) both shape as
  `{ error: { message, field? } }` via one `setErrorHandler`.
- **Config**: `$CONFIG_DIR/.env` (default `/config/.env`) is loaded on
  startup via `dotenv`. Real environment variables (e.g.
  docker-compose `environment:`) always take precedence over the file.
  Default config files ship in `config-defaults/` and are seeded into
  `$CONFIG_DIR` on first container start only; existing files there
  are never overwritten. The entrypoint uses `find`, not a `*` glob,
  to copy them — a bare glob silently skips dotfiles like
  `config-defaults/.env`.
- **Dev/seed database** lives at `./data/dev`, separate from `./data`
  (what `docker-compose.yml` bind-mounts), so a local `docker compose
up` and `npm run dev`/`npm run seed` never contend for one file.
- **Never commit** `./data/` or `./config/` (gitignored) — local
  SQLite file and local config overrides.

## Docker / deploy

- Non-root runtime user (`app`, uid/gid 1000 by default); `PUID`/`PGID`
  env vars remap it to match the host at container start. The base
  `node:24-alpine` image now predefines its own `node` user at uid/gid
  1000, so the runtime stage deletes it (`deluser node`) before
  creating `app` at that uid/gid — verified against a real image;
  `addgroup -g 1000 app` fails outright otherwise. This remap requires
  starting the container as root — incompatible with rootless Docker
  or Kubernetes `runAsNonRoot`, in which case the entrypoint detects
  the non-root start and skips the remap rather than failing.
- `better-sqlite3` is a native addon; it ships bundled prebuilt
  bindings per-platform since v13 (no separate `prebuild-install`
  step), but npm still runs its `install: node-gyp rebuild` script
  unconditionally regardless of whether a matching prebuild exists —
  and that fails with no compiler toolchain installed, which this
  image deliberately doesn't carry. Both `npm ci` invocations
  (build and runtime stages) pass `--ignore-scripts`; the runtime
  stage's `node -e "new require('better-sqlite3')(...)"` smoke test
  after install is what proves the bundled prebuild still loads
  correctly without that script having run. The build stage
  separately needs `npm rebuild esbuild` after `--ignore-scripts`,
  since vite's esbuild dependency _does_ need its postinstall (it
  downloads a platform binary) to run `vite build` at all.
- The runtime stage does a fresh `npm ci --omit=dev --ignore-scripts`
  rather than copying `node_modules` across stages, so dev
  dependencies never end up in the shipped image.
- `HEALTHCHECK` hits `/api/health`, which also does a cheap `SELECT 1`
  against SQLite — so a wedged/locked db file fails the check too, not
  just process liveness.
- **No authentication by default.** Every route is open. Gating access
  (reverse-proxy auth, VPN/tailnet, forward-auth middleware, etc.) is
  the deploying environment's responsibility, not this app's.
- **No reverse proxy baked in.** The container just publishes its
  port (`3000` by default); whatever sits in front of it is a
  deployment-time decision.
- Images publish to `ghcr.io/cdcaskey/time-since` on every push to
  `main` (see `.github/workflows/publish.yml`), private by default.
- **Backups are the deployment's responsibility** — `$DATA_DIR` is
  just a mounted volume. Because SQLite runs in WAL mode, back it up
  with `sqlite3 time-since.db ".backup ..."` or `VACUUM INTO`, not a
  raw `cp` while the container is running — a plain copy can miss the
  `-wal`/`-shm` files and land on a torn state.
- **Verified against a real `docker build` + `docker compose up`**:
  image builds, container reports healthy, a task created via the API
  survives `docker compose down && docker compose up`, and
  `config-defaults/.env` seeds into a fresh `./config` without being
  clobbered on a second start. Docker Desktop on macOS remaps
  bind-mount ownership, so `PUID`/`PGID` permission behavior itself
  still needs checking against a real Linux host.

## Roadmap (deferred, not built)

v1 is create/edit/delete/complete/undo on a live-ranked list — that's
all of it. Deliberately absent, one migration each, in no particular
dependency order except M3 assumes M2's archived-task filtering:

- **M2 — Archive**: retire a task without losing its history
  (`archived_at` column, excluded from ranking/search until
  unarchived).
- **M3 — History, backdating, cadence stats**: per-task completion
  history with notes and backdating, plus "you actually do this every
  N days" stats. First milestone needing a second route (no router in
  v1).
- **M4 — Snooze**: hide a task temporarily without pausing its clock;
  snooze duration is derived from the task's own `dueAfter` (¼/½/1×),
  never a global default.
- **M5 — Tags**: filterable tags, worth building once the list is
  unwieldy enough to need them.

## Decisions log

- **Continuous urgency score**, not separate banding + tiebreak logic
  — one function maps elapsed time through a task's own thresholds
  onto one number; the band and the sort order both fall out of it.
- **A completions log, not a `last_completed_at` column** — the log
  is what makes per-completion history (M3) possible; a single column
  can't be reconstructed retrospectively.
- **Client-side scoring**, and therefore client-side sorting and
  search as a direct consequence — the alternative (server-computed
  score) would need either polling or the server tracking wall-clock
  time it has no business tracking.
- **UUID task/completion ids**, minted client-side before the
  request — what makes the optimistic "mark done → undo" flow simple:
  undo knows which completion to delete without waiting for a
  response.
- **Epoch-ms timestamps**, not the template's `datetime('now')`
  example — the whole app is arithmetic on elapsed time.
- **Fixed-length duration units** (week = 7 days, month = 30 days),
  not calendar arithmetic — one conversion module, no drift between a
  "1 month" task created in January vs. April.
- **No router until M3** — v1 has exactly one screen.
- **v1 omits columns for every deferred feature** rather than adding
  them early — so M2 exercises a real migration against a live
  database, which is the point of not doing it in the initial schema.
- **Kept the template's `db` singleton** instead of injecting a
  handle — already supports `fastify.inject()` tests and per-test-file
  temp databases; refactoring it would have bought nothing.
- **Stepped TypeScript back to 6.x** to regain `typescript-eslint`,
  in exchange for the two `no-restricted-imports` rules that
  mechanically enforce this project's most dangerous traps (server/
  leaking into the client bundle, and static imports breaking
  `dotenv` load order).
- **Dev/seed database at `./data/dev`**, separate from the `./data`
  compose bind-mounts, so local dev and a local `docker compose up`
  can coexist without fighting over one SQLite file.
- **`npm ci --ignore-scripts` in the Docker build**, discovered via a
  real `docker build`: better-sqlite3 bundles prebuilt bindings and
  doesn't need its install script to run at all, but npm runs it
  unconditionally and it fails with no compiler toolchain installed.
  Skipping scripts avoids needing one; `npm rebuild esbuild` in the
  build stage restores the one script that's actually needed there.
