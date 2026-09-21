import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// vite.config.ts doesn't set test.globals, so @testing-library/react's own
// auto-cleanup (which looks for a global afterEach) never registers —
// without this, DOM from one test leaks into the next within a file.
afterEach(cleanup);

// Mantine components probe these DOM APIs on mount; jsdom doesn't
// implement them, so component tests hang or throw without stubs.
// (server-side tests run in the 'node' environment, no window here.)
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });

  window.ResizeObserver =
    window.ResizeObserver ??
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };

  Object.defineProperty(window, 'scrollTo', { value: () => {}, writable: true });
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {});
}
