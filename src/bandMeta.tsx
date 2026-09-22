import type { Band } from '@shared/urgency';
import { Check, Clock, Warning, WarningOctagon } from '@phosphor-icons/react';

// Band communicated by label + icon, never by color alone (§8).
export const bandLabel: Record<Band, string> = {
  urgent: 'Urgent',
  overdue: 'Overdue',
  due: 'Due',
  ok: 'OK',
};

export const bandIcon: Record<Band, typeof Check> = {
  urgent: WarningOctagon,
  overdue: Warning,
  due: Clock,
  ok: Check,
};
