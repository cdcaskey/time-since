import crypto from 'node:crypto';
import { runMigrations } from './migrate.js';
import { db } from './db.js';

const DAY = 24 * 60 * 60;
const now = Date.now();

interface SeedTask {
  name: string;
  description: string;
  dueAfterSeconds: number;
  overdueAfterSeconds: number;
  urgentAfterSeconds: number;
  createdDaysAgo: number;
  lastCompletedDaysAgo: number | null;
}

// A dozen tasks spread across all four bands, with plausible (backdated)
// completion histories, so the UI can be judged against something
// representative rather than an empty list. Two are never completed, to
// exercise the "ages from creation" anchor.
const SEED_TASKS: SeedTask[] = [
  {
    name: 'Take out trash',
    description: 'Bins to the curb the night before pickup',
    dueAfterSeconds: 1 * DAY,
    overdueAfterSeconds: 2 * DAY,
    urgentAfterSeconds: 4 * DAY,
    createdDaysAgo: 60,
    lastCompletedDaysAgo: 3,
  },
  {
    name: 'Water houseplants',
    description: '',
    dueAfterSeconds: 7 * DAY,
    overdueAfterSeconds: 14 * DAY,
    urgentAfterSeconds: 28 * DAY,
    createdDaysAgo: 90,
    lastCompletedDaysAgo: 20,
  },
  {
    name: 'Vacuum living room',
    description: '',
    dueAfterSeconds: 7 * DAY,
    overdueAfterSeconds: 14 * DAY,
    urgentAfterSeconds: 28 * DAY,
    createdDaysAgo: 90,
    lastCompletedDaysAgo: 10,
  },
  {
    name: 'Clean gutters',
    description: 'Front and back',
    dueAfterSeconds: 90 * DAY,
    overdueAfterSeconds: 180 * DAY,
    urgentAfterSeconds: 270 * DAY,
    createdDaysAgo: 400,
    lastCompletedDaysAgo: 340,
  },
  {
    name: 'Change AC filter',
    description: '',
    dueAfterSeconds: 30 * DAY,
    overdueAfterSeconds: 60 * DAY,
    urgentAfterSeconds: 90 * DAY,
    createdDaysAgo: 200,
    lastCompletedDaysAgo: 95,
  },
  {
    name: 'Rotate mattress',
    description: '',
    dueAfterSeconds: 180 * DAY,
    overdueAfterSeconds: 270 * DAY,
    urgentAfterSeconds: 365 * DAY,
    createdDaysAgo: 200,
    lastCompletedDaysAgo: 30,
  },
  {
    name: 'Descale coffee maker',
    description: '',
    dueAfterSeconds: 30 * DAY,
    overdueAfterSeconds: 60 * DAY,
    urgentAfterSeconds: 90 * DAY,
    createdDaysAgo: 120,
    lastCompletedDaysAgo: 45,
  },
  {
    name: 'Replace smoke detector batteries',
    description: '',
    dueAfterSeconds: 365 * DAY,
    overdueAfterSeconds: 400 * DAY,
    urgentAfterSeconds: 450 * DAY,
    createdDaysAgo: 200,
    lastCompletedDaysAgo: null,
  },
  {
    name: 'Deep clean fridge',
    description: '',
    dueAfterSeconds: 30 * DAY,
    overdueAfterSeconds: 60 * DAY,
    urgentAfterSeconds: 90 * DAY,
    createdDaysAgo: 60,
    lastCompletedDaysAgo: 5,
  },
  {
    name: 'Test fire extinguisher',
    description: '',
    dueAfterSeconds: 365 * DAY,
    overdueAfterSeconds: 400 * DAY,
    urgentAfterSeconds: 450 * DAY,
    createdDaysAgo: 700,
    lastCompletedDaysAgo: 500,
  },
  {
    name: 'Call grandmother',
    description: '',
    dueAfterSeconds: 7 * DAY,
    overdueAfterSeconds: 10 * DAY,
    urgentAfterSeconds: 14 * DAY,
    createdDaysAgo: 60,
    lastCompletedDaysAgo: 9,
  },
  {
    name: 'Backup photos',
    description: '',
    dueAfterSeconds: 30 * DAY,
    overdueAfterSeconds: 45 * DAY,
    urgentAfterSeconds: 60 * DAY,
    createdDaysAgo: 10,
    lastCompletedDaysAgo: null,
  },
];

function seed(): void {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM tasks').get() as { count: number };
  if (count > 0) {
    console.log(`[seed] ${count} task(s) already present, skipping`);
    return;
  }

  const insertTask = db.prepare(
    `INSERT INTO tasks (id, name, description, due_after_seconds, overdue_after_seconds, urgent_after_seconds, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  const insertCompletion = db.prepare(
    `INSERT INTO completions (id, task_id, completed_at, note, created_at)
     VALUES (?, ?, ?, NULL, ?)`,
  );

  const seedAll = db.transaction(() => {
    for (const task of SEED_TASKS) {
      const id = crypto.randomUUID();
      const createdAt = now - task.createdDaysAgo * DAY * 1000;
      insertTask.run(
        id,
        task.name,
        task.description,
        task.dueAfterSeconds,
        task.overdueAfterSeconds,
        task.urgentAfterSeconds,
        createdAt,
        createdAt,
      );

      if (task.lastCompletedDaysAgo !== null) {
        const completedAt = now - task.lastCompletedDaysAgo * DAY * 1000;
        insertCompletion.run(crypto.randomUUID(), id, completedAt, completedAt);
      }
    }
  });

  seedAll();
  console.log(`[seed] inserted ${SEED_TASKS.length} tasks`);
}

runMigrations();
seed();
