import { afterEach, describe, expect, it, vi } from 'vitest';
import { faker } from '@faker-js/faker';
import { renderWithProviders, screen, waitFor } from './test-utils';
import { App } from './App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('renders whatever health status the API returns', async () => {
    // Random per run so the test can't pass just because it hardcodes
    // the happy-path 'ok'/'ok' response.
    const status = faker.helpers.arrayElement(['ok', 'error'] as const);
    const dbStatus = faker.helpers.arrayElement(['ok', 'error'] as const);

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ status, db: dbStatus }),
      }),
    );

    renderWithProviders(<App />);

    await waitFor(() => {
      expect(screen.getByText(`api ${status} / db ${dbStatus}`)).toBeInTheDocument();
    });
  });
});
