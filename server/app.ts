import fs from 'node:fs';
import Fastify, { type FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { checkDb } from './db.js';

export function buildApp(distDir: string): FastifyInstance {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

  app.get('/api/health', async (_req, reply) => {
    const dbOk = checkDb();
    reply.code(dbOk ? 200 : 503).send({ status: dbOk ? 'ok' : 'error', db: dbOk ? 'ok' : 'error' });
  });

  // Dist only exists after build; in dev Vite serves directly.
  if (fs.existsSync(distDir)) {
    app.register(fastifyStatic, {
      root: distDir,
      wildcard: false,
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.raw.url?.startsWith('/api/')) {
        reply.code(404).send({ error: 'not found' });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  return app;
}
