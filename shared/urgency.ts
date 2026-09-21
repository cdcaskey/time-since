export type Band = 'ok' | 'due' | 'overdue' | 'urgent';

export interface UrgencyInput {
  /** epoch ms of the most recent completion, or of task creation if never completed */
  anchorAt: number;
  dueAfterSeconds: number;
  overdueAfterSeconds: number;
  urgentAfterSeconds: number;
  /** epoch ms */
  now: number;
}

// Maps elapsed time through the three thresholds onto one continuous score
// (dueAfter -> 1, overdueAfter -> 2, urgentAfter -> 3), linearly interpolated
// between them and continuing to grow beyond urgentAfter using the final
// band's width as the unit. The band is a function of the score and ordering
// *is* the score — see CLAUDE.md for why this must never be split into
// separate banding/tiebreak logic.
export function urgencyScore(input: UrgencyInput): number {
  const { anchorAt, dueAfterSeconds, overdueAfterSeconds, urgentAfterSeconds, now } = input;
  const elapsed = (now - anchorAt) / 1000;

  if (elapsed <= 0) return 0;
  if (elapsed < dueAfterSeconds) return elapsed / dueAfterSeconds;
  if (elapsed < overdueAfterSeconds) {
    return 1 + (elapsed - dueAfterSeconds) / (overdueAfterSeconds - dueAfterSeconds);
  }
  if (elapsed < urgentAfterSeconds) {
    return 2 + (elapsed - overdueAfterSeconds) / (urgentAfterSeconds - overdueAfterSeconds);
  }
  return 3 + (elapsed - urgentAfterSeconds) / (urgentAfterSeconds - overdueAfterSeconds);
}

export function bandForScore(score: number): Band {
  if (score < 1) return 'ok';
  if (score < 2) return 'due';
  if (score < 3) return 'overdue';
  return 'urgent';
}
