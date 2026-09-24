import { bandForScore, urgencyScore, type Band } from '@shared/urgency';
import type { TaskDto } from '@shared/types';

export interface RankedTask {
  task: TaskDto;
  score: number;
  band: Band;
}

// Anchor is the last completion, or task creation if it's never been done
// (§6) — so a brand-new task ages from when you added it instead of
// appearing instantly urgent. Ordering is the score, descending, then name
// for stability — no separate tiebreak concept.
export function rankTasks(tasks: TaskDto[], now: number): RankedTask[] {
  return tasks
    .map((task) => {
      const anchorAt = task.lastCompletedAt ?? task.createdAt;
      const score = urgencyScore({
        anchorAt,
        dueAfterSeconds: task.dueAfterSeconds,
        overdueAfterSeconds: task.overdueAfterSeconds,
        urgentAfterSeconds: task.urgentAfterSeconds,
        now,
      });
      const timeBand = bandForScore(score);
      // A never-completed task's initialState is a floor under the time
      // calculation, not an override of it: once real elapsed time carries
      // the task past "ok" on its own, that natural band wins.
      const band =
        task.lastCompletedAt === null && timeBand === 'ok' && task.initialState !== null
          ? task.initialState
          : timeBand;
      return { task, score, band };
    })
    .sort((a, b) => b.score - a.score || a.task.name.localeCompare(b.task.name));
}

export const BAND_ORDER: Band[] = ['urgent', 'overdue', 'due', 'ok'];

export function groupByBand(ranked: RankedTask[]): Record<Band, RankedTask[]> {
  const groups: Record<Band, RankedTask[]> = { urgent: [], overdue: [], due: [], ok: [] };
  for (const item of ranked) groups[item.band].push(item);
  return groups;
}

export function filterTasks(tasks: TaskDto[], query: string): TaskDto[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === '') return tasks;

  return tasks.filter(
    (task) =>
      task.name.toLowerCase().includes(normalized) ||
      task.description.toLowerCase().includes(normalized),
  );
}
