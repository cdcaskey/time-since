import type { Band } from '@shared/urgency';
import { IconAlertOctagon, IconAlertTriangle, IconCheck, IconClock } from './icons';

// Band communicated by label + icon, never by color alone (§8).
export const bandLabel: Record<Band, string> = {
  urgent: 'Urgent',
  overdue: 'Overdue',
  due: 'Due',
  ok: 'OK',
};

export const bandIcon: Record<Band, typeof IconCheck> = {
  urgent: IconAlertOctagon,
  overdue: IconAlertTriangle,
  due: IconClock,
  ok: IconCheck,
};
