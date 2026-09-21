import { AppShell, Container, Group, Title } from '@mantine/core';
import { ColorSchemeToggle } from './components/ColorSchemeToggle';
import { TaskListView } from './components/TaskListView';

export function App() {
  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Title order={4}>Time Since</Title>
          <ColorSchemeToggle />
        </Group>
      </AppShell.Header>
      <AppShell.Main>
        <Container size="sm" px={0}>
          <TaskListView />
        </Container>
      </AppShell.Main>
    </AppShell>
  );
}
