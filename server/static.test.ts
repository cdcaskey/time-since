import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';

// buildApp only registers static serving when distDir exists, so this file
// (unlike app.test.ts) creates a real dist/ with an index.html fixture to
// exercise that path — app.test.ts deliberately points at a directory that
// doesn't exist, to keep static serving off for the rest of the API tests.
let app: FastifyInstance;
let dataDir: string;
let distDir: string;

beforeAll(async () => {
  dataDir = mkdtempSync(path.join(tmpdir(), 'time-since-static-test-'));
  process.env.DATA_DIR = dataDir;

  distDir = path.join(dataDir, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(path.join(distDir, 'index.html'), '<!doctype html><title>Time Since</title>');

  const { runMigrations } = await import('./migrate.js');
  const { buildApp } = await import('./app.js');

  runMigrations();
  app = buildApp(distDir);
});

afterAll(async () => {
  await app.close();
  rmSync(dataDir, { recursive: true, force: true });
});

describe('static SPA fallback', () => {
  it('serves the built index.html for an unknown client route', async () => {
    const res = await app.inject({ method: 'GET', url: '/some/client/route' });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('Time Since');
  });

  it('returns 404 JSON, not the HTML shell, for an unknown API route', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.json()).toEqual({ error: { message: 'not found' } });
  });
});
