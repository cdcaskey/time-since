import { z } from 'zod';

const positiveInt = z.number().int().positive();

export interface ThresholdIssue {
  path: 'overdueAfterSeconds' | 'urgentAfterSeconds';
  message: string;
}

// Shared by createTaskSchema's superRefine below and by the PATCH route
// (server-side, after merging the patch onto the existing task) — both need
// the same "strictly increasing" check with a field-level error.
export function thresholdOrderingIssues(thresholds: {
  dueAfterSeconds: number;
  overdueAfterSeconds: number;
  urgentAfterSeconds: number;
}): ThresholdIssue[] {
  const issues: ThresholdIssue[] = [];
  if (thresholds.overdueAfterSeconds <= thresholds.dueAfterSeconds) {
    issues.push({
      path: 'overdueAfterSeconds',
      message: 'overdueAfterSeconds must be greater than dueAfterSeconds',
    });
  }
  if (thresholds.urgentAfterSeconds <= thresholds.overdueAfterSeconds) {
    issues.push({
      path: 'urgentAfterSeconds',
      message: 'urgentAfterSeconds must be greater than overdueAfterSeconds',
    });
  }
  return issues;
}

export const taskNameSchema = z.string().trim().min(1).max(200);
export const taskDescriptionSchema = z.string().max(2000);

export const createTaskSchema = z
  .object({
    name: taskNameSchema,
    description: taskDescriptionSchema.optional().default(''),
    dueAfterSeconds: positiveInt,
    overdueAfterSeconds: positiveInt,
    urgentAfterSeconds: positiveInt,
  })
  .superRefine((value, ctx) => {
    for (const issue of thresholdOrderingIssues(value)) {
      ctx.addIssue({ code: 'custom', message: issue.message, path: [issue.path] });
    }
  });

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export const updateTaskSchema = z
  .object({
    name: taskNameSchema.optional(),
    description: taskDescriptionSchema.optional(),
    dueAfterSeconds: positiveInt.optional(),
    overdueAfterSeconds: positiveInt.optional(),
    urgentAfterSeconds: positiveInt.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'at least one field is required' });

export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

export const createCompletionSchema = z.object({
  id: z.string().uuid(),
  note: z.string().max(2000).optional(),
});

export type CreateCompletionInput = z.infer<typeof createCompletionSchema>;
