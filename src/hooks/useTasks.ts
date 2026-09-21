import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateTaskInput, UpdateTaskInput } from '@shared/schemas';
import type { TaskDto } from '@shared/types';
import {
  createCompletionRequest,
  createTaskRequest,
  deleteCompletionRequest,
  deleteTaskRequest,
  fetchTasks,
  updateTaskRequest,
} from '../api/client';

export const tasksQueryKey = ['tasks'] as const;

export function useTasksQuery() {
  return useQuery({ queryKey: tasksQueryKey, queryFn: fetchTasks });
}

interface CompleteTaskVars {
  taskId: string;
  completionId: string;
}

// The completion id is minted by the caller (crypto.randomUUID()) before the
// request goes out, so Undo knows exactly which completion to delete without
// waiting for a response — see CLAUDE.md on UUID keys.
export function useCompleteTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ taskId, completionId }: CompleteTaskVars) =>
      createCompletionRequest(taskId, { id: completionId }),
    onMutate: async ({ taskId }) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey });
      const previous = queryClient.getQueryData<TaskDto[]>(tasksQueryKey);
      const now = Date.now();

      queryClient.setQueryData<TaskDto[]>(tasksQueryKey, (tasks) =>
        tasks?.map((task) =>
          task.id === taskId
            ? { ...task, lastCompletedAt: now, completionCount: task.completionCount + 1 }
            : task,
        ),
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(tasksQueryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });
}

// Undo just deletes the completion and refetches — the task's true
// lastCompletedAt (MAX(completed_at) over what remains) is recomputed
// server-side, so there's no local "previous score" to track separately.
export function useUndoCompletionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (completionId: string) => deleteCompletionRequest(completionId),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });
}

export function useCreateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTaskRequest(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });
}

export function useUpdateTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateTaskInput }) =>
      updateTaskRequest(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteTaskRequest(id),
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: tasksQueryKey });
      const previous = queryClient.getQueryData<TaskDto[]>(tasksQueryKey);

      queryClient.setQueryData<TaskDto[]>(tasksQueryKey, (tasks) =>
        tasks?.filter((t) => t.id !== id),
      );

      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(tasksQueryKey, context.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: tasksQueryKey });
    },
  });
}
