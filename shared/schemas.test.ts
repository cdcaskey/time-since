import { describe, expect, it } from 'vitest';
import {
  createCompletionSchema,
  createTaskSchema,
  thresholdOrderingIssues,
  updateTaskSchema,
} from './schemas.js';

const validTask = {
  name: 'Clean gutters',
  description: 'Front and back',
  dueAfterSeconds: 100,
  overdueAfterSeconds: 200,
  urgentAfterSeconds: 400,
};

describe('thresholdOrderingIssues', () => {
  it('returns no issues when thresholds strictly increase', () => {
    expect(
      thresholdOrderingIssues({
        dueAfterSeconds: 1,
        overdueAfterSeconds: 2,
        urgentAfterSeconds: 3,
      }),
    ).toEqual([]);
  });

  it('flags overdueAfterSeconds when it does not exceed dueAfterSeconds', () => {
    const issues = thresholdOrderingIssues({
      dueAfterSeconds: 10,
      overdueAfterSeconds: 10,
      urgentAfterSeconds: 20,
    });
    expect(issues).toEqual([
      {
        path: 'overdueAfterSeconds',
        message: 'overdueAfterSeconds must be greater than dueAfterSeconds',
      },
    ]);
  });

  it('flags urgentAfterSeconds when it does not exceed overdueAfterSeconds', () => {
    const issues = thresholdOrderingIssues({
      dueAfterSeconds: 10,
      overdueAfterSeconds: 20,
      urgentAfterSeconds: 15,
    });
    expect(issues).toEqual([
      {
        path: 'urgentAfterSeconds',
        message: 'urgentAfterSeconds must be greater than overdueAfterSeconds',
      },
    ]);
  });

  it('flags both when everything collapses to the same value', () => {
    const issues = thresholdOrderingIssues({
      dueAfterSeconds: 10,
      overdueAfterSeconds: 10,
      urgentAfterSeconds: 10,
    });
    expect(issues).toHaveLength(2);
  });
});

describe('createTaskSchema', () => {
  it('accepts a valid task', () => {
    const result = createTaskSchema.safeParse(validTask);
    expect(result.success).toBe(true);
  });

  it('defaults description to empty string when omitted', () => {
    const { name, dueAfterSeconds, overdueAfterSeconds, urgentAfterSeconds } = validTask;
    const result = createTaskSchema.parse({
      name,
      dueAfterSeconds,
      overdueAfterSeconds,
      urgentAfterSeconds,
    });
    expect(result.description).toBe('');
  });

  it('rejects a blank name', () => {
    const result = createTaskSchema.safeParse({ ...validTask, name: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects a name over 200 characters', () => {
    const result = createTaskSchema.safeParse({ ...validTask, name: 'a'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('accepts a name at exactly 200 characters', () => {
    const result = createTaskSchema.safeParse({ ...validTask, name: 'a'.repeat(200) });
    expect(result.success).toBe(true);
  });

  it.each(['dueAfterSeconds', 'overdueAfterSeconds', 'urgentAfterSeconds'])(
    'rejects a non-positive %s',
    (field) => {
      const result = createTaskSchema.safeParse({ ...validTask, [field]: 0 });
      expect(result.success).toBe(false);
    },
  );

  it.each(['dueAfterSeconds', 'overdueAfterSeconds', 'urgentAfterSeconds'])(
    'rejects a non-integer %s',
    (field) => {
      const result = createTaskSchema.safeParse({ ...validTask, [field]: 1.5 });
      expect(result.success).toBe(false);
    },
  );

  it('rejects and names the field when overdueAfterSeconds does not exceed dueAfterSeconds', () => {
    const result = createTaskSchema.safeParse({ ...validTask, overdueAfterSeconds: 100 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['overdueAfterSeconds']);
    }
  });

  it('rejects and names the field when urgentAfterSeconds does not exceed overdueAfterSeconds', () => {
    const result = createTaskSchema.safeParse({ ...validTask, urgentAfterSeconds: 150 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual(['urgentAfterSeconds']);
    }
  });
});

describe('updateTaskSchema', () => {
  it('accepts a single-field patch', () => {
    expect(updateTaskSchema.safeParse({ name: 'New name' }).success).toBe(true);
  });

  it('rejects an empty patch', () => {
    expect(updateTaskSchema.safeParse({}).success).toBe(false);
  });

  it('rejects an invalid field even when patching just that field', () => {
    expect(updateTaskSchema.safeParse({ dueAfterSeconds: -5 }).success).toBe(false);
  });
});

describe('createCompletionSchema', () => {
  it('accepts an id with an optional note', () => {
    const result = createCompletionSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      note: 'done early',
    });
    expect(result.success).toBe(true);
  });

  it('accepts an id with no note', () => {
    const result = createCompletionSchema.safeParse({ id: '123e4567-e89b-12d3-a456-426614174000' });
    expect(result.success).toBe(true);
  });

  it('rejects a non-uuid id', () => {
    const result = createCompletionSchema.safeParse({ id: 'not-a-uuid' });
    expect(result.success).toBe(false);
  });
});
