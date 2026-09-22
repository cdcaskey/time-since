import type { MantineColorSchemeManager } from '@mantine/core';

/**
 * Keeps color scheme in memory only, for the lifetime of the tab — no
 * localStorage read/write, so a reload always falls back to `auto`
 * (system) rather than resuming whatever was last toggled.
 */
export function inMemoryColorSchemeManager(): MantineColorSchemeManager {
  return {
    get: (defaultValue) => defaultValue,
    set: () => {},
    subscribe: () => {},
    unsubscribe: () => {},
    clear: () => {},
  };
}
