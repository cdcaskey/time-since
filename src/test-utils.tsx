import type { ReactElement } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { theme } from './theme';

export function renderWithProviders(ui: ReactElement, options?: RenderOptions) {
  // Fresh client per render, retries off — a failing request should fail
  // the test immediately instead of retrying into a timeout.
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(ui, {
    wrapper: ({ children }) => (
      <QueryClientProvider client={queryClient}>
        <MantineProvider theme={theme}>
          <Notifications />
          {children}
        </MantineProvider>
      </QueryClientProvider>
    ),
    ...options,
  });
}

export * from '@testing-library/react';
