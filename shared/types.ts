import type { Band } from './urgency.js';

export interface TaskDto {
  id: string;
  name: string;
  description: string;
  dueAfterSeconds: number;
  overdueAfterSeconds: number;
  urgentAfterSeconds: number;
  createdAt: number;
  updatedAt: number;
  /** MAX(completed_at) across the task's completions, null if never completed */
  lastCompletedAt: number | null;
  /** Band to show while never-completed and the time calculation is still "ok" */
  initialState: Band | null;
  completionCount: number;
}

export interface CompletionDto {
  id: string;
  taskId: string;
  completedAt: number;
  note: string | null;
  createdAt: number;
}

export interface ApiError {
  error: {
    message: string;
    field?: string;
  };
}
