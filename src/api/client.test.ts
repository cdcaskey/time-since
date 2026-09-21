import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ApiRequestError,
  createCompletionRequest,
  createTaskRequest,
  deleteCompletionRequest,
  deleteTaskRequest,
  fetchTasks,
  updateTaskRequest,
} from './client';

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchTasks', () => {
  it('returns the parsed task list on success', async () => {
    const tasks = [{ id: '1', name: 'A' }];
    stubFetch(200, tasks);

    await expect(fetchTasks()).resolves.toEqual(tasks);
    expect(fetch).toHaveBeenCalledWith(
      '/api/tasks',
      expect.objectContaining({ headers: expect.any(Object) }),
    );
  });

  it('throws ApiRequestError with the field from a 400 response', async () => {
    stubFetch(400, { error: { message: 'bad', field: 'name' } });

    await expect(fetchTasks()).rejects.toMatchObject({
      status: 400,
      message: 'bad',
      field: 'name',
    });
    await expect(fetchTasks()).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('falls back to a generic message when the error body has no message', async () => {
    stubFetch(500, undefined);
    await expect(fetchTasks()).rejects.toMatchObject({ status: 500, message: 'request failed' });
  });
});

describe('createTaskRequest', () => {
  it('POSTs the input and returns the created task', async () => {
    const created = { id: '1', name: 'New' };
    stubFetch(201, created);

    const result = await createTaskRequest({
      name: 'New',
      description: '',
      dueAfterSeconds: 100,
      overdueAfterSeconds: 200,
      urgentAfterSeconds: 400,
    });

    expect(result).toEqual(created);
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toMatchObject({ name: 'New' });
  });
});

describe('updateTaskRequest', () => {
  it('PATCHes the given fields', async () => {
    stubFetch(200, { id: '1', name: 'Renamed' });
    await updateTaskRequest('1', { name: 'Renamed' });

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/tasks/1');
    expect(init.method).toBe('PATCH');
  });
});

describe('deleteTaskRequest / deleteCompletionRequest', () => {
  it('resolves with no body on a 204 response', async () => {
    stubFetch(204, undefined);
    await expect(deleteTaskRequest('1')).resolves.toBeUndefined();
  });

  it('sends DELETE for completions', async () => {
    stubFetch(204, undefined);
    await deleteCompletionRequest('c1');

    const [url, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/completions/c1');
    expect(init.method).toBe('DELETE');
  });
});

describe('createCompletionRequest', () => {
  it('POSTs to the task-scoped completions endpoint', async () => {
    const completion = { id: 'c1', taskId: 't1' };
    stubFetch(201, completion);

    const result = await createCompletionRequest('t1', { id: 'c1' });

    expect(result).toEqual(completion);
    const [url] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/tasks/t1/completions');
  });
});
