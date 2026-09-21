# Time Since

Track repeating tasks — the ones you do on no fixed schedule, like
cleaning gutters or calling your grandmother — and see a prioritised
list of what's most neglected right now, based on how long it's been
since each was last done.

Each task carries three thresholds (due / overdue / urgent), and the
list re-ranks itself live as time passes — a daily task two days late
outranks an annual task six months early. See `CLAUDE.md` for the
scoring model and the rest of the stack conventions.

## Local development

```
npm install
npm run dev
```

Vite serves the frontend on http://localhost:5173 and proxies
`/api/*` to the Fastify API on port 3001. The dev database lives at
`./data/dev/time-since.db` — separate from the `./data` directory
`docker-compose.yml` bind-mounts, so a local `docker compose up`
alongside `npm run dev` can never fight over one database file.

Load it with a dozen realistic tasks spread across all four bands:

```
npm run seed
```

`npm run seed` is idempotent — it skips seeding (and says so) if any
tasks already exist. Wipe the dev database (and its `-wal`/`-shm`
siblings) at any time with `rm -rf data/dev`.

## Production build

```
npm run build
DATA_DIR=./data/dev npm start
```

Serves the built SPA and API together on port 3000 (`PORT` to
override). `npm start` and `npm run migrate` don't run inside a
container here, so unlike `npm run dev` they need `DATA_DIR` passed
explicitly — there's no compose `environment:` block supplying it.

## Docker

```
mkdir -p data config
docker compose up -d
```

Pulls `ghcr.io/cdcaskey/time-since:latest` — this doesn't build an
image locally; compose uses `image:`, not `build:`. See
`docker-compose.yml` for the full deployment (volumes, health check,
port).

- **`PUID` / `PGID`** (default `1000`/`1000`) remap the container's
  internal user to match a host user, so files written into
  `./data` and `./config` have predictable ownership on a Linux
  host. Find your own with `id -u` and `id -g`, and set them in
  `docker-compose.yml`'s `environment:` block if they're not 1000.
- **macOS won't reproduce ownership problems.** Docker Desktop remaps
  bind-mount ownership on macOS, so a mismatched `PUID`/`PGID` (or a
  permissions bug) that would break on a real Linux host can look
  fine locally. Test permission-sensitive changes against an actual
  Linux host before trusting them.
- The database lives at `$DATA_DIR/time-since.db` (default
  `/data/time-since.db`, i.e. `./data/time-since.db` on the host with
  the default compose file). SQLite runs in WAL mode, so back it up
  with `sqlite3 time-since.db ".backup ..."` or `VACUUM INTO`, never
  a raw `cp` while the container is running — see `CLAUDE.md`.
- **No authentication.** Every route is open by design; put
  something in front of it (a reverse proxy with forward-auth, a
  VPN/tailnet, etc.) if it needs to be gated. See `CLAUDE.md` for
  why.
