import { AppShell, Group, Title } from '@mantine/core';

export function App() {
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md">
          <Title order={4}>Time Since</Title>
        </Group>
      </AppShell.Header>
      <AppShell.Main></AppShell.Main>
    </AppShell>
  );
}
