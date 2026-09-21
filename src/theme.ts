import { createTheme, type MantineThemeOverride } from '@mantine/core';
import type { Band } from '@shared/urgency';

// Shared base theme — extend per app here rather than overriding
// component styles inline. Keeps the "consistent base" promise real
// instead of just aspirational.
export const theme: MantineThemeOverride = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'system-ui, -apple-system, sans-serif',
});

// The one place band -> color is decided, so no component hard-codes a
// Mantine color name (or a hex value) for a band.
export const bandColor: Record<Band, string> = {
  ok: 'gray',
  due: 'yellow',
  overdue: 'orange',
  urgent: 'red',
};
