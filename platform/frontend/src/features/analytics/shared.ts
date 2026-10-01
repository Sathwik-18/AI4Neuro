import type { Role } from '@/lib/roles';
import { ROLE_META } from '@/lib/roles';
import type { StatsRange } from '@/features/analysis/types';

/** Rolling windows counting today, matching the backend's /analysis/stats. */
export const RANGE_OPTIONS: { value: StatsRange; label: string; daysBack: number | null }[] = [
  { value: 'today', label: 'Today', daysBack: 0 },
  { value: 'week', label: 'Past week', daysBack: 6 },
  { value: 'month', label: 'Past month', daysBack: 29 },
  { value: 'quarter', label: 'Past 3 months', daysBack: 89 },
  { value: 'all', label: 'All time', daysBack: null },
];

/** Reports adds longer presets on top of the analytics ranges. */
export const DURATION_OPTIONS: { value: string; label: string; daysBack: number | null }[] = [
  { value: 'all', label: 'All time', daysBack: null },
  { value: 'today', label: 'Today', daysBack: 0 },
  { value: 'week', label: 'Past week', daysBack: 6 },
  { value: 'month', label: 'Past month', daysBack: 29 },
  { value: 'quarter', label: 'Past 3 months', daysBack: 89 },
  { value: 'half', label: 'Past 6 months', daysBack: 182 },
  { value: 'year', label: 'Past year', daysBack: 364 },
];

export function dateFromForDuration(value: string): string | undefined {
  const opt = DURATION_OPTIONS.find((o) => o.value === value);
  if (!opt || opt.daysBack === null) return undefined;
  const d = new Date();
  d.setDate(d.getDate() - opt.daysBack);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
}

export function reportsPathFor(role: Role): string {
  return `/${ROLE_META[role].routeSegment}/reports`;
}

export function viewerPathFor(role: Role, sessionId: string): string {
  if (role === 'doctor' || role === 'radiologist' || role === 'patient') {
    return `/${ROLE_META[role].routeSegment}/viewer/${sessionId}`;
  }
  return `/analysis/${sessionId}`;
}
