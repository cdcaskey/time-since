import { useState, type ReactNode } from 'react';
import { Badge, Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import type { Band } from '@shared/urgency';
import { bandColor } from '../theme';
import { bandIcon, bandLabel } from '../bandMeta';

interface BandSectionProps {
  band: Band;
  count: number;
  defaultOpen: boolean;
  children: ReactNode;
}

export function BandSection({ band, count, defaultOpen, children }: BandSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = bandIcon[band];

  return (
    <Stack gap="xs">
      <UnstyledButton
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${bandLabel[band]} (${count})`}
      >
        <Group gap="xs">
          <Icon size={18} color={`var(--mantine-color-${bandColor[band]}-6)`} />
          <Text fw={600}>{bandLabel[band]}</Text>
          <Badge color={bandColor[band]} variant="light">
            {count}
          </Badge>
        </Group>
      </UnstyledButton>
      <Collapse expanded={open}>
        <Stack gap="sm">{children}</Stack>
      </Collapse>
    </Stack>
  );
}
