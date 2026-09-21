import { ActionIcon } from '@mantine/core';

interface AddTaskButtonProps {
  onClick: () => void;
}

// Floating action button, not a header button — mobile-first (§8): a
// thumb-reachable corner target beats something that scrolls out of view.
export function AddTaskButton({ onClick }: AddTaskButtonProps) {
  return (
    <ActionIcon size={56} radius="xl" aria-label="Add task" onClick={onClick}>
      <svg
        width={24}
        height={24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
      >
        <path d="M12 5v14M5 12h14" strokeLinecap="round" />
      </svg>
    </ActionIcon>
  );
}
