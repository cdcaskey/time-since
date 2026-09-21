# spa-template

Base template for lightweight React + Mantine SPAs, backed by SQLite,
shipped as a single Docker container.

To start a new app: use this repo as a GitHub template (or clone it),
rename references to `<app-name>` / `<owner>` in `docker-compose.yml`
and `.github/workflows/publish.yml`, and start replacing
`src/App.tsx` and `server/migrations/2026-09-20.1_init.sql`.

See `CLAUDE.md` for the full set of stack conventions.

## Local development

```
npm install
npm run dev
```

Vite serves the frontend on http://localhost:5173 and proxies `/api/*`
to the Fastify API on port 3001. The SQLite db is created at
`./data/app.db` locally (set `DATA_DIR` to override).

## Production build

```
npm run build
npm start
```

Serves the built SPA and API together on port 3000 (`PORT` to
override).

## Docker

```
docker build -t <app-name> .
docker compose up -d
```

See `docker-compose.yml` for the example deployment (volumes, health
check, port). No reverse proxy or auth is included - see `CLAUDE.md`
for why.
