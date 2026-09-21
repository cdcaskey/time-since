import { describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { TaskDto } from '@shared/types';
import { renderWithProviders, screen, waitFor } from '../test-utils';
import { TaskListView } from './TaskListView';

const { fetchTasks } = vi.hoisted(() => ({ fetchTasks: vi.fn() }));

vi.mock('../api/client', () => ({
  fetchTasks,
  createTaskRequest: vi.fn(),
  updateTaskRequest: vi.fn(),
  deleteTaskRequest: vi.fn(),
  createCompletionRequest: vi.fn(),
  deleteCompletionRequest: vi.fn(),
}));

// useNow() reads the real wall clock, so task timestamps here are anchored
// to Date.now() rather than an arbitrary fixed epoch.
const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

function makeTask(overrides: Partial<TaskDto>): TaskDto {
  return {
    id: crypto.randomUUID(),
    name: 'Task',
    description: '',
    dueAfterSeconds: 86400,
    overdueAfterSeconds: 172800,
    urgentAfterSeconds: 345600,
    createdAt: NOW - 10 * DAY,
    updatedAt: NOW - 10 * DAY,
    lastCompletedAt: NOW - 10 * DAY,
    completionCount: 1,
    ...overrides,
  };
}

describe('TaskListView', () => {
  it('shows the empty state when there are no tasks', async () => {
    fetchTasks.mockResolvedValue([]);
    renderWithProviders(<TaskListView />);

    expect(await screen.findByText('Add your first task')).toBeInTheDocument();
  });

  it('shows "nothing needs doing" when every task is OK', async () => {
    fetchTasks.mockResolvedValue([makeTask({ name: 'Water plants', lastCompletedAt: NOW })]);
    renderWithProviders(<TaskListView />);

    expect(await screen.findByText('Nothing needs doing — nice.')).toBeInTheDocument();
  });

  it('groups tasks under their band section, most urgent first', async () => {
    fetchTasks.mockResolvedValue([
      makeTask({ name: 'Urgent task', lastCompletedAt: NOW - 400 * DAY }),
      makeTask({ name: 'OK task', lastCompletedAt: NOW }),
    ]);
    renderWithProviders(<TaskListView />);

    expect(await screen.findByText('Urgent task')).toBeInTheDocument();

    // Sections toggle expanded state via aria-expanded; Urgent starts open,
    // OK starts collapsed.
    const urgentToggle = screen.getByRole('button', { name: 'Urgent (1)' });
    const okToggle = screen.getByRole('button', { name: 'OK (1)' });
    expect(urgentToggle).toHaveAttribute('aria-expanded', 'true');
    expect(okToggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('filters the list by search query', async () => {
    const user = userEvent.setup();
    fetchTasks.mockResolvedValue([
      makeTask({ name: 'Clean gutters', lastCompletedAt: NOW - 400 * DAY }),
      makeTask({ name: 'Water plants', lastCompletedAt: NOW - 400 * DAY }),
    ]);
    renderWithProviders(<TaskListView />);

    await screen.findByText('Clean gutters');
    await user.type(screen.getByPlaceholderText('Search tasks'), 'gutters');

    await waitFor(() => {
      expect(screen.queryByText('Water plants')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Clean gutters')).toBeInTheDocument();
  });
});
