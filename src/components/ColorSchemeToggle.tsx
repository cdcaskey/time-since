import { ActionIcon, useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { Moon, Sun } from '@phosphor-icons/react';

export function ColorSchemeToggle() {
  const { setColorScheme } = useMantineColorScheme();
  const computedColorScheme = useComputedColorScheme('light');

  return (
    <ActionIcon
      variant="default"
      size="lg"
      aria-label="Toggle color scheme"
      onClick={() => setColorScheme(computedColorScheme === 'dark' ? 'light' : 'dark')}
    >
      {computedColorScheme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </ActionIcon>
  );
}
