import { useState } from 'react';
import { Affix, Alert, Center, Loader, Stack, Text, TextInput } from '@mantine/core';
import type { TaskDto } from '@shared/types';
import { useTasksQuery } from '../hooks/useTasks';
import { useNow } from '../hooks/useNow';
import { BAND_ORDER, filterTasks, groupByBand, rankTasks } from '../taskRanking';
import { BandSection } from './BandSection';
import { TaskCard } from './TaskCard';
import { TaskFormModal } from './TaskFormModal';
import { AddTaskButton } from './AddTaskButton';
import { MagnifyingGlass } from '@phosphor-icons/react';

const NOW_INTERVAL_MS = 30_000;

type FormState = { mode: 'create' } | { mode: 'edit'; task: TaskDto } | null;

export function TaskListView() {
  const query = useTasksQuery();
  const now = useNow(NOW_INTERVAL_MS);
  const [search, setSearch] = useState('');
  const [formState, setFormState] = useState<FormState>(null);

  const modal = (
    <TaskFormModal
      opened={formState !== null}
      onClose={() => setFormState(null)}
      task={formState?.mode === 'edit' ? formState.task : undefined}
    />
  );

  const addButton = (
    <Affix position={{ bottom: 24, right: 24 }}>
      <AddTaskButton onClick={() => setFormState({ mode: 'create' })} />
    </Affix>
  );

  if (query.isPending) {
    return (
      <Center py="xl">
        <Loader />
      </Center>
    );
  }

  if (query.isError) {
    return (
      <Alert color="red" title="Couldn't load tasks">
        Try reloading the page.
      </Alert>
    );
  }

  const tasks = query.data;

  if (tasks.length === 0) {
    return (
      <>
        <Center py="xl">
          <Stack align="center" gap={4}>
            <Text fw={600}>Add your first task</Text>
            <Text size="sm" c="dimmed">
              Track something you do repeatedly, and see when it&rsquo;s due again.
            </Text>
          </Stack>
        </Center>
        {addButton}
        {modal}
      </>
    );
  }

  const unfilteredGroups = groupByBand(rankTasks(tasks, now));
  const nothingDue =
    unfilteredGroups.urgent.length === 0 &&
    unfilteredGroups.overdue.length === 0 &&
    unfilteredGroups.due.length === 0;

  const filtered = filterTasks(tasks, search);
  const noSearchResults = search.trim() !== '' && filtered.length === 0;
  const groups = groupByBand(rankTasks(filtered, now));

  return (
    <>
      <Stack gap="lg">
        <TextInput
          placeholder="Search tasks"
          aria-label="Search tasks"
          leftSection={<MagnifyingGlass size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
        />

        {noSearchResults ? (
          <Center py="md">
            <Text c="dimmed">No tasks match &ldquo;{search}&rdquo;</Text>
          </Center>
        ) : (
          <>
            {nothingDue && (
              <Center py="md">
                <Text c="dimmed">Nothing needs doing — nice.</Text>
              </Center>
            )}

            {BAND_ORDER.map((band) => {
              const items = groups[band];
              if (items.length === 0) return null;

              return (
                <BandSection
                  key={band}
                  band={band}
                  count={items.length}
                  defaultOpen={band !== 'ok'}
                >
                  {items.map(({ task, score, band: itemBand }) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      score={score}
                      band={itemBand}
                      now={now}
                      onEdit={(t) => setFormState({ mode: 'edit', task: t })}
                    />
                  ))}
                </BandSection>
              );
            })}
          </>
        )}
      </Stack>
      {addButton}
      {modal}
    </>
  );
}
