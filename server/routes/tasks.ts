import type { FastifyInstance } from 'fastify';
import {
  createCompletionSchema,
  createTaskSchema,
  thresholdOrderingIssues,
  updateTaskSchema,
} from '../../shared/schemas.js';
import * as repo from '../tasks.repo.js';
import { badRequest, notFound } from '../http-errors.js';
import { parseOrThrow } from '../validate.js';

export function registerTaskRoutes(app: FastifyInstance): void {
  app.get('/api/tasks', async () => repo.listTasks());

  app.post('/api/tasks', async (req, reply) => {
    const input = parseOrThrow(createTaskSchema, req.body);
    reply.code(201);
    return repo.createTask(input);
  });

  app.get('/api/tasks/:id', async (req) => {
    const { id } = req.params as { id: string };
    const task = repo.getTask(id);
    if (!task) throw notFound('task not found');
    return task;
  });

  app.patch('/api/tasks/:id', async (req) => {
    const { id } = req.params as { id: string };
    const patch = parseOrThrow(updateTaskSchema, req.body);

    const existing = repo.getTask(id);
    if (!existing) throw notFound('task not found');

    // Cross-field ordering can only be checked once the patch is merged onto
    // the existing thresholds — a single-field patch has no view of the
    // other two on its own.
    const issues = thresholdOrderingIssues({
      dueAfterSeconds: patch.dueAfterSeconds ?? existing.dueAfterSeconds,
      overdueAfterSeconds: patch.overdueAfterSeconds ?? existing.overdueAfterSeconds,
      urgentAfterSeconds: patch.urgentAfterSeconds ?? existing.urgentAfterSeconds,
    });
    if (issues.length > 0) throw badRequest(issues[0].message, issues[0].path);

    return repo.updateTask(id, patch);
  });

  app.delete('/api/tasks/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!repo.deleteTask(id)) throw notFound('task not found');
    return reply.code(204).send();
  });

  app.post('/api/tasks/:id/completions', async (req, reply) => {
    const { id: taskId } = req.params as { id: string };
    const input = parseOrThrow(createCompletionSchema, req.body);

    if (!repo.getTask(taskId)) throw notFound('task not found');

    reply.code(201);
    return repo.createCompletion({ id: input.id, taskId, note: input.note });
  });

  app.delete('/api/completions/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!repo.deleteCompletion(id)) throw notFound('completion not found');
    return reply.code(204).send();
  });
}
