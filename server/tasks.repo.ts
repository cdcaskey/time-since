import crypto from 'node:crypto';
import type { CompletionDto, TaskDto } from '../shared/types.js';
import { db } from './db.js';

interface TaskRow {
  id: string;
  name: string;
  description: string;
  due_after_seconds: number;
  overdue_after_seconds: number;
  urgent_after_seconds: number;
  created_at: number;
  updated_at: number;
}

interface CompletionRow {
  id: string;
  task_id: string;
  completed_at: number;
  note: string | null;
  created_at: number;
}

interface CompletionAggregateRow {
  task_id: string;
  last_completed_at: number;
  completion_count: number;
}

function toTaskDto(
  row: TaskRow,
  aggregate: { lastCompletedAt: number | null; completionCount: number },
): TaskDto {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    dueAfterSeconds: row.due_after_seconds,
    overdueAfterSeconds: row.overdue_after_seconds,
    urgentAfterSeconds: row.urgent_after_seconds,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastCompletedAt: aggregate.lastCompletedAt,
    completionCount: aggregate.completionCount,
  };
}

function toCompletionDto(row: CompletionRow): CompletionDto {
  return {
    id: row.id,
    taskId: row.task_id,
    completedAt: row.completed_at,
    note: row.note,
    createdAt: row.created_at,
  };
}

export function listTasks(): TaskDto[] {
  const taskRows = db.prepare('SELECT * FROM tasks').all() as TaskRow[];
  const aggregateRows = db
    .prepare(
      `SELECT task_id, MAX(completed_at) AS last_completed_at, COUNT(*) AS completion_count
       FROM completions
       GROUP BY task_id`,
    )
    .all() as CompletionAggregateRow[];

  const aggregatesByTaskId = new Map(aggregateRows.map((row) => [row.task_id, row]));

  return taskRows.map((row) => {
    const aggregate = aggregatesByTaskId.get(row.id);
    return toTaskDto(row, {
      lastCompletedAt: aggregate?.last_completed_at ?? null,
      completionCount: aggregate?.completion_count ?? 0,
    });
  });
}

export function getTask(id: string): TaskDto | undefined {
  const row = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as TaskRow | undefined;
  if (!row) return undefined;

  const aggregate = db
    .prepare(
      `SELECT MAX(completed_at) AS last_completed_at, COUNT(*) AS completion_count
       FROM completions
       WHERE task_id = ?`,
    )
    .get(id) as { last_completed_at: number | null; completion_count: number };

  return toTaskDto(row, {
    lastCompletedAt: aggregate.last_completed_at,
    completionCount: aggregate.completion_count,
  });
}

export interface CreateTaskParams {
  name: string;
  description: string;
  dueAfterSeconds: number;
  overdueAfterSeconds: number;
  urgentAfterSeconds: number;
}

export function createTask(params: CreateTaskParams): TaskDto {
  const id = crypto.randomUUID();
  const now = Date.now();

  db.prepare(
    `INSERT INTO tasks (id, name, description, due_after_seconds, overdue_after_seconds, urgent_after_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    id,
    params.name,
    params.description,
    params.dueAfterSeconds,
    params.overdueAfterSeconds,
    params.urgentAfterSeconds,
    now,
    now,
  );

  return getTask(id)!;
}

export interface UpdateTaskParams {
  name?: string;
  description?: string;
  dueAfterSeconds?: number;
  overdueAfterSeconds?: number;
  urgentAfterSeconds?: number;
}

const UPDATABLE_COLUMNS: Record<keyof UpdateTaskParams, string> = {
  name: 'name',
  description: 'description',
  dueAfterSeconds: 'due_after_seconds',
  overdueAfterSeconds: 'overdue_after_seconds',
  urgentAfterSeconds: 'urgent_after_seconds',
};

export function updateTask(id: string, params: UpdateTaskParams): TaskDto | undefined {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined) as [
    keyof UpdateTaskParams,
    string | number,
  ][];
  if (entries.length === 0) return getTask(id);

  const setClause = entries.map(([key]) => `${UPDATABLE_COLUMNS[key]} = ?`).join(', ');
  const values = entries.map(([, value]) => value);

  const result = db
    .prepare(`UPDATE tasks SET ${setClause}, updated_at = ? WHERE id = ?`)
    .run(...values, Date.now(), id);

  if (result.changes === 0) return undefined;
  return getTask(id);
}

export function deleteTask(id: string): boolean {
  const result = db.prepare('DELETE FROM tasks WHERE id = ?').run(id);
  return result.changes > 0;
}

export interface CreateCompletionParams {
  id: string;
  taskId: string;
  note?: string;
}

export function createCompletion(params: CreateCompletionParams): CompletionDto {
  const now = Date.now();
  db.prepare(
    `INSERT INTO completions (id, task_id, completed_at, note, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(params.id, params.taskId, now, params.note ?? null, now);

  const row = db.prepare('SELECT * FROM completions WHERE id = ?').get(params.id) as CompletionRow;
  return toCompletionDto(row);
}

export function deleteCompletion(id: string): boolean {
  const result = db.prepare('DELETE FROM completions WHERE id = ?').run(id);
  return result.changes > 0;
}
