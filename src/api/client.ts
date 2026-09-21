import type { CreateCompletionInput, CreateTaskInput, UpdateTaskInput } from '@shared/schemas';
import type { ApiError, CompletionDto, TaskDto } from '@shared/types';

export class ApiRequestError extends Error {
  status: number;
  field?: string;

  constructor(status: number, message: string, field?: string) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });

  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => undefined);

  if (!res.ok) {
    const apiError = body as ApiError | undefined;
    throw new ApiRequestError(
      res.status,
      apiError?.error?.message ?? 'request failed',
      apiError?.error?.field,
    );
  }

  return body as T;
}

export function fetchTasks(): Promise<TaskDto[]> {
  return request('/api/tasks');
}

export function createTaskRequest(input: CreateTaskInput): Promise<TaskDto> {
  return request('/api/tasks', { method: 'POST', body: JSON.stringify(input) });
}

export function updateTaskRequest(id: string, input: UpdateTaskInput): Promise<TaskDto> {
  return request(`/api/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function deleteTaskRequest(id: string): Promise<void> {
  return request(`/api/tasks/${id}`, { method: 'DELETE' });
}

export function createCompletionRequest(
  taskId: string,
  input: CreateCompletionInput,
): Promise<CompletionDto> {
  return request(`/api/tasks/${taskId}/completions`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function deleteCompletionRequest(id: string): Promise<void> {
  return request(`/api/completions/${id}`, { method: 'DELETE' });
}
