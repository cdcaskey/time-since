import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import type { TaskDto } from '@shared/types';
import { renderWithProviders, screen, waitFor } from '../test-utils';
import { TaskCard } from './TaskCard';

const { createCompletionRequest, deleteCompletionRequest, deleteTaskRequest } = vi.hoisted(() => ({
  createCompletionRequest: vi.fn().mockResolvedValue({ id: 'completion-1' }),
  deleteCompletionRequest: vi.fn().mockResolvedValue(undefined),
  deleteTaskRequest: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../api/client', () => ({
  createCompletionRequest,
  deleteCompletionRequest,
  deleteTaskRequest,
  fetchTasks: vi.fn(),
  createTaskRequest: vi.fn(),
  updateTaskRequest: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

const task: TaskDto = {
  id: 'task-1',
  name: 'Clean gutters',
  description: 'Front and back',
  dueAfterSeconds: 100,
  overdueAfterSeconds: 200,
  urgentAfterSeconds: 400,
  createdAt: 1000,
  updatedAt: 1000,
  lastCompletedAt: null,
  initialState: null,
  completionCount: 0,
};

describe('TaskCard done/undo flow', () => {
  it('records a completion when Done is clicked and shows an Undo toast', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TaskCard task={task} score={1.5} band="due" now={2000} onEdit={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      expect(createCompletionRequest).toHaveBeenCalledWith('task-1', { id: expect.any(String) });
    });

    expect(await screen.findByText('Marked "Clean gutters" done')).toBeInTheDocument();
    const undoButton = screen.getByRole('button', { name: 'Undo' });

    const [, { id: completionId }] = createCompletionRequest.mock.calls[0];
    await user.click(undoButton);

    await waitFor(() => {
      expect(deleteCompletionRequest).toHaveBeenCalledWith(completionId);
    });
  });
});

describe('TaskCard edit flow', () => {
  it('calls onEdit with the task when Edit is clicked', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    renderWithProviders(<TaskCard task={task} score={1.5} band="due" now={2000} onEdit={onEdit} />);

    await user.click(screen.getByRole('button', { name: 'Task actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Edit' }));

    expect(onEdit).toHaveBeenCalledWith(task);
  });
});

describe('TaskCard delete flow', () => {
  it('requires confirmation before deleting', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <TaskCard task={task} score={1.5} band="due" now={2000} onEdit={vi.fn()} />,
    );

    await user.click(screen.getByRole('button', { name: 'Task actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));

    expect(
      await screen.findByText(/permanently destroys its completion history/),
    ).toBeInTheDocument();
    expect(deleteTaskRequest).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteTaskRequest).toHaveBeenCalledWith('task-1');
    });
  });
});

describe('TaskCard never-completed badge', () => {
  it('shows a "Never done" badge instead of a relative time', () => {
    renderWithProviders(<TaskCard task={task} score={0.5} band="ok" now={2000} onEdit={vi.fn()} />);
    expect(screen.getByText('Never done')).toBeInTheDocument();
  });
});
