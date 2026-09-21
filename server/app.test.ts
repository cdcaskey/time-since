import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

// DATA_DIR is read at import time by db.ts, so it must be set — to a
// throwaway dir, isolated from any real $DATA_DIR — before app.ts (and
// its transitive db.ts import) are loaded. A static top-level import
// would be hoisted above this assignment, so the modules are loaded
// dynamically instead, after the env var is in place.
let app: FastifyInstance;
let dataDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'time-since-test-'));
  process.env.DATA_DIR = dataDir;

  const { runMigrations } = await import('./migrate.js');
  const { buildApp } = await import('./app.js');

  runMigrations();

  // No dist/ in this temp dir, so static file serving stays disabled.
  app = buildApp(path.join(dataDir, 'dist'));
});

afterAll(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

describe('GET /api/health', () => {
  it('reports ok when the db is reachable', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', db: 'ok' });
  });
});
