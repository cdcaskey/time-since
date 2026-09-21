import type { ZodType } from 'zod';
import { badRequest } from './http-errors.js';

export function parseOrThrow<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;

  const issue = result.error.issues[0];
  const field = issue.path.length > 0 ? String(issue.path[0]) : undefined;
  throw badRequest(issue.message, field);
}
