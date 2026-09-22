import { ActionIcon } from '@mantine/core';
import { Plus } from '@phosphor-icons/react';

interface AddTaskButtonProps {
  onClick: () => void;
}

// Floating action button, not a header button — mobile-first (§8): a
// thumb-reachable corner target beats something that scrolls out of view.
export function AddTaskButton({ onClick }: AddTaskButtonProps) {
  return (
    <ActionIcon size={56} radius="xl" aria-label="Add task" onClick={onClick}>
      <Plus size={24} weight="bold" />
    </ActionIcon>
  );
}
