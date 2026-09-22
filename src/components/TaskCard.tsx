import { useState } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Popover,
  Progress,
  Stack,
  Text,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { TaskDto } from '@shared/types';
import type { Band } from '@shared/urgency';
import { formatElapsed } from '@shared/duration';
import { bandColor } from '../theme';
import { bandLabel } from '../bandMeta';
import { DotsThree } from '@phosphor-icons/react';
import {
  useCompleteTaskMutation,
  useDeleteTaskMutation,
  useUndoCompletionMutation,
} from '../hooks/useTasks';

interface TaskCardProps {
  task: TaskDto;
  score: number;
  band: Band;
  now: number;
  onEdit: (task: TaskDto) => void;
}

export function TaskCard({ task, score, band, now, onEdit }: TaskCardProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const completeMutation = useCompleteTaskMutation();
  const undoMutation = useUndoCompletionMutation();
  const deleteMutation = useDeleteTaskMutation();

  const neverCompleted = task.lastCompletedAt === null;
  const anchorAt = task.lastCompletedAt ?? task.createdAt;
  const elapsedSeconds = Math.max(0, (now - anchorAt) / 1000);
  const progress = Math.min(100, (score / 3) * 100);

  function handleDone() {
    const completionId = crypto.randomUUID();
    completeMutation.mutate({ taskId: task.id, completionId });

    notifications.show({
      id: completionId,
      color: 'teal',
      autoClose: 8000,
      message: (
        <Group justify="space-between" wrap="nowrap" gap="md">
          <Text size="sm">Marked "{task.name}" done</Text>
          <Button
            size="xs"
            variant="subtle"
            onClick={() => {
              undoMutation.mutate(completionId);
              notifications.hide(completionId);
            }}
          >
            Undo
          </Button>
        </Group>
      ),
    });
  }

  function handleConfirmDelete() {
    deleteMutation.mutate(task.id);
    setDeleteOpen(false);
  }

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={600}>{task.name}</Text>
            {task.description !== '' && (
              <Text size="sm" c="dimmed" lineClamp={2}>
                {task.description}
              </Text>
            )}
          </Stack>

          <Popover
            opened={deleteOpen}
            onChange={setDeleteOpen}
            position="bottom-end"
            withArrow
            shadow="md"
          >
            <Menu position="bottom-end" withinPortal>
              <Popover.Target>
                <Menu.Target>
                  <ActionIcon variant="subtle" color="gray" aria-label="Task actions">
                    <DotsThree size={18} weight="bold" />
                  </ActionIcon>
                </Menu.Target>
              </Popover.Target>
              <Menu.Dropdown>
                <Menu.Item onClick={() => onEdit(task)}>Edit</Menu.Item>
                <Menu.Item color="red" onClick={() => setDeleteOpen(true)}>
                  Delete
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Popover.Dropdown maw={260}>
              <Stack gap="xs">
                <Text size="sm">
                  Delete &ldquo;{task.name}&rdquo;? This permanently destroys its completion
                  history.
                </Text>
                <Group justify="flex-end" gap="xs">
                  <Button size="xs" variant="default" onClick={() => setDeleteOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="xs" color="red" onClick={handleConfirmDelete}>
                    Delete
                  </Button>
                </Group>
              </Stack>
            </Popover.Dropdown>
          </Popover>
        </Group>

        <Group justify="space-between" wrap="nowrap">
          {neverCompleted ? (
            <Badge color="gray" variant="outline">
              Never done
            </Badge>
          ) : (
            <Tooltip label={new Date(anchorAt).toLocaleString()}>
              <Text size="sm" c="dimmed">
                {formatElapsed(elapsedSeconds)}
              </Text>
            </Tooltip>
          )}
          <Badge color={bandColor[band]} variant="light">
            {bandLabel[band]}
          </Badge>
        </Group>

        <Progress value={progress} color={bandColor[band]} size="sm" />

        <Button fullWidth onClick={handleDone} loading={completeMutation.isPending}>
          Done
        </Button>
      </Stack>
    </Card>
  );
}
