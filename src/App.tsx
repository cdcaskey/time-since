import { useEffect, useState } from 'react';
import { AppShell, Badge, Group, Text, Title } from '@mantine/core';

type HealthResponse = { status: 'ok'; db: 'ok' | 'error' };

export function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>App Name</Title>
          <Badge color={health?.status === 'ok' ? 'green' : 'gray'}>
            {health ? `api ${health.status} / db ${health.db}` : 'connecting…'}
          </Badge>
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Text>
          Replace this with the actual app. This shell just proves the API, database and build
          pipeline are wired up.
        </Text>
      </AppShell.Main>
    </AppShell>
  );
}
