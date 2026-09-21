import { createTheme, type MantineThemeOverride } from '@mantine/core';

// Shared base theme — extend per app here rather than overriding
// component styles inline. Keeps the "consistent base" promise real
// instead of just aspirational.
export const theme: MantineThemeOverride = createTheme({
  primaryColor: 'blue',
  defaultRadius: 'md',
  fontFamily: 'system-ui, -apple-system, sans-serif',
});
