import { Group, Stack, Text } from '@mantine/core';
import { formatElapsed } from '@shared/duration';
import { bandColor } from '../theme';

// formatElapsed is written for "time since" ("3 days ago"); a threshold is a
// forward-looking duration, so drop the "ago" rather than duplicating the
// unit-picking logic here.
function formatDurationLabel(seconds: number): string {
  return formatElapsed(seconds).replace(/ ago$/, '');
}

interface ThresholdPreviewProps {
  dueAfterSeconds: number;
  overdueAfterSeconds: number;
  urgentAfterSeconds: number;
}

// A horizontal timeline of the four bands, proportioned by the thresholds
// themselves — not a fixed width per band — so the preview actually shows
// what the numbers mean (e.g. a daily task's "urgent" sliver next to a
// wide "ok" band would look very different from an annual task's).
export function ThresholdPreview({
  dueAfterSeconds,
  overdueAfterSeconds,
  urgentAfterSeconds,
}: ThresholdPreviewProps) {
  const valid =
    dueAfterSeconds > 0 &&
    overdueAfterSeconds > dueAfterSeconds &&
    urgentAfterSeconds > overdueAfterSeconds;
  if (!valid) return null;

  // Show a little past "urgent" so that band isn't a zero-width sliver.
  const total = urgentAfterSeconds + (urgentAfterSeconds - overdueAfterSeconds);
  const segments: { band: 'ok' | 'due' | 'overdue' | 'urgent'; widthPct: number }[] = [
    { band: 'ok', widthPct: (dueAfterSeconds / total) * 100 },
    { band: 'due', widthPct: ((overdueAfterSeconds - dueAfterSeconds) / total) * 100 },
    { band: 'overdue', widthPct: ((urgentAfterSeconds - overdueAfterSeconds) / total) * 100 },
    { band: 'urgent', widthPct: ((total - urgentAfterSeconds) / total) * 100 },
  ];

  return (
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        Timeline preview
      </Text>
      <Group gap={2} wrap="nowrap" style={{ height: 8, borderRadius: 4, overflow: 'hidden' }}>
        {segments.map(({ band, widthPct }) => (
          <div
            key={band}
            style={{
              width: `${widthPct}%`,
              height: '100%',
              backgroundColor: `var(--mantine-color-${bandColor[band]}-5)`,
            }}
          />
        ))}
      </Group>
      <Group justify="space-between">
        <Text size="xs" c="dimmed">
          now
        </Text>
        <Text size="xs" c="dimmed">
          due {formatDurationLabel(dueAfterSeconds)}
        </Text>
        <Text size="xs" c="dimmed">
          overdue {formatDurationLabel(overdueAfterSeconds)}
        </Text>
        <Text size="xs" c="dimmed">
          urgent {formatDurationLabel(urgentAfterSeconds)}
        </Text>
      </Group>
    </Stack>
  );
}
