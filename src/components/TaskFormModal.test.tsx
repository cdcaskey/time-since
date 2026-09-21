import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { TaskDto } from '@shared/types';
import { renderWithProviders, screen, waitFor } from '../test-utils';
import { TaskFormModal } from './TaskFormModal';

const { createTaskRequest, updateTaskRequest } = vi.hoisted(() => ({
  createTaskRequest: vi.fn().mockResolvedValue({ id: 'new-task' }),
  updateTaskRequest: vi.fn().mockResolvedValue({ id: 'task-1' }),
}));

vi.mock('../api/client', async () => {
  const actual = await vi.importActual<typeof import('../api/client')>('../api/client');
  return {
    ...actual,
    createTaskRequest,
    updateTaskRequest,
    fetchTasks: vi.fn(),
    deleteTaskRequest: vi.fn(),
    createCompletionRequest: vi.fn(),
    deleteCompletionRequest: vi.fn(),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

function dueValueInput() {
  return screen.getByRole('textbox', { name: 'Due after' });
}

function overdueValueInput() {
  return screen.getByRole('textbox', { name: 'Overdue after' });
}

function urgentValueInput() {
  return screen.getByRole('textbox', { name: 'Urgent after' });
}

describe('TaskFormModal auto-fill', () => {
  it('fills overdue (2x) and urgent (4x) from due while both are untouched', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskFormModal opened onClose={vi.fn()} />);

    await user.clear(dueValueInput());
    await user.type(dueValueInput(), '3');

    await waitFor(() => {
      expect(overdueValueInput()).toHaveValue('6');
      expect(urgentValueInput()).toHaveValue('12');
    });
  });

  it('stops auto-filling a field once the user edits it directly', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskFormModal opened onClose={vi.fn()} />);

    await user.clear(overdueValueInput());
    await user.type(overdueValueInput(), '10');

    await user.clear(dueValueInput());
    await user.type(dueValueInput(), '3');

    await waitFor(() => {
      expect(urgentValueInput()).toHaveValue('12');
    });
    // Overdue was touched, so it keeps the user's value instead of 2x due.
    expect(overdueValueInput()).toHaveValue('10');
  });
});

describe('TaskFormModal cadence presets', () => {
  it('fills all three thresholds from a preset', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskFormModal opened onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Weekly' }));

    await waitFor(() => {
      expect(dueValueInput()).toHaveValue('1');
      expect(overdueValueInput()).toHaveValue('2');
      expect(urgentValueInput()).toHaveValue('4');
    });
  });
});

describe('TaskFormModal validation', () => {
  it('shows an error when overdue does not exceed due', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TaskFormModal opened onClose={vi.fn()} />);

    await user.clear(overdueValueInput());
    await user.type(overdueValueInput(), '10');
    await user.clear(dueValueInput());
    await user.type(dueValueInput(), '20');

    expect(await screen.findByText(/overdueAfterSeconds must be greater than/)).toBeInTheDocument();
  });
});

describe('TaskFormModal submit', () => {
  it('creates a task with the entered values', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<TaskFormModal opened onClose={onClose} />);

    await user.type(screen.getByLabelText('Name', { exact: false }), 'Clean gutters');
    await user.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(createTaskRequest).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Clean gutters',
          dueAfterSeconds: 86400,
          overdueAfterSeconds: 172800,
          urgentAfterSeconds: 345600,
        }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('pre-fills an existing task for editing and submits an update', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const task: TaskDto = {
      id: 'task-1',
      name: 'Water plants',
      description: '',
      dueAfterSeconds: 7 * 86400,
      overdueAfterSeconds: 14 * 86400,
      urgentAfterSeconds: 28 * 86400,
      createdAt: 1000,
      updatedAt: 1000,
      lastCompletedAt: null,
      completionCount: 0,
    };

    renderWithProviders(<TaskFormModal opened onClose={onClose} task={task} />);

    expect(screen.getByLabelText('Name', { exact: false })).toHaveValue('Water plants');
    expect(dueValueInput()).toHaveValue('1');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(updateTaskRequest).toHaveBeenCalledWith(
        'task-1',
        expect.objectContaining({ name: 'Water plants' }),
      );
    });
    expect(onClose).toHaveBeenCalled();
  });

  it('does not auto-fill overdue/urgent from due when editing', async () => {
    const user = userEvent.setup();
    const task: TaskDto = {
      id: 'task-1',
      name: 'Water plants',
      description: '',
      dueAfterSeconds: 7 * 86400,
      overdueAfterSeconds: 14 * 86400,
      urgentAfterSeconds: 28 * 86400,
      createdAt: 1000,
      updatedAt: 1000,
      lastCompletedAt: null,
      completionCount: 0,
    };

    renderWithProviders(<TaskFormModal opened onClose={vi.fn()} task={task} />);

    await user.clear(dueValueInput());
    await user.type(dueValueInput(), '3');

    // Overdue/urgent already had real values in edit mode, so a due edit
    // must not clobber them.
    expect(overdueValueInput()).toHaveValue('2');
    expect(urgentValueInput()).toHaveValue('4');
  });
});

describe('TaskFormModal timeline preview', () => {
  it('renders once thresholds are valid', () => {
    renderWithProviders(<TaskFormModal opened onClose={vi.fn()} />);
    expect(screen.getByText('Timeline preview')).toBeInTheDocument();
  });
});
