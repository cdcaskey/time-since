import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load $CONFIG_DIR/.env before anything else reads process.env. dotenv
// does not override variables already set in the environment, so real
// env vars (e.g. from docker-compose `environment:`) always win over
// the file — no extra precedence logic needed here.
const CONFIG_DIR = process.env.CONFIG_DIR ?? '/config';
dotenv.config({ path: path.join(CONFIG_DIR, '.env') });

// Static imports are hoisted above the dotenv.config() call above, so
// anything that reads process.env at module-load time (db.ts's
// DATA_DIR) would see it before the .env file was loaded. Load these
// dynamically instead, now that the env is actually in place.
const { runMigrations } = await import('./migrate.js');
const { buildApp } = await import('./app.js');
const { db } = await import('./db.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3000);
// __dirname at runtime is server/dist/server (rootDir ".." mirrors the
// repo layout under dist/ so server/ can import shared/); the frontend
// build lives at the repo root's dist/, three levels up.
const DIST_DIR = path.join(__dirname, '..', '..', '..', 'dist');

// In dev, Vite serves the frontend directly and dist/ legitimately
// doesn't exist; in production a missing dist/ means a broken image,
// so fail loudly instead of quietly serving API-only 404s.
if (process.env.NODE_ENV === 'production' && !fs.existsSync(DIST_DIR)) {
  console.error(`[fatal] DIST_DIR not found at ${DIST_DIR} — build output missing`);
  process.exit(1);
}

runMigrations();

const app = buildApp(DIST_DIR);

app.listen({ port: PORT, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});

async function shutdown(): Promise<void> {
  await app.close();
  db.close();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
