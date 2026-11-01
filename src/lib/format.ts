import type { BlockType, CadenceMode, ItemRole, LogFormat, PlanDay, PlanItem } from '../db/schema';

export const LOG_FORMAT_LABEL: Record<LogFormat, string> = {
  sets_weighted: 'Sets · weight · reps',
  sets_bodyweight: 'Sets · reps',
  time_distance: 'Time · distance · intervals',
  time_effort: 'Time · effort',
};

export const LOG_FORMATS = Object.keys(LOG_FORMAT_LABEL) as LogFormat[];

export const CADENCE_LABEL: Record<CadenceMode, string> = {
  day_number: 'Day numbers',
  weekdays: 'Days of the week',
};

export const BLOCK_LABEL: Record<BlockType, string> = {
  straight: '',
  superset: 'Superset',
  pre_exhaust: 'Pre-exhaust',
};

export const ROLE_LABEL: Record<ItemRole, string> = {
  warmup: 'Warm-up',
  pre_exhaust: 'Pre-exhaust',
  working: 'Working',
};

/** Monday-first display order; values are JS weekday numbers (0 = Sunday). */
export const WEEK = [
  { n: 1, short: 'Mon', long: 'Monday' },
  { n: 2, short: 'Tue', long: 'Tuesday' },
  { n: 3, short: 'Wed', long: 'Wednesday' },
  { n: 4, short: 'Thu', long: 'Thursday' },
  { n: 5, short: 'Fri', long: 'Friday' },
  { n: 6, short: 'Sat', long: 'Saturday' },
  { n: 0, short: 'Sun', long: 'Sunday' },
];

export function dayTitle(d: Pick<PlanDay, 'dayNumber' | 'weekday'>): string {
  if (d.weekday != null) return WEEK.find((w) => w.n === d.weekday)?.long ?? 'Day';
  if (d.dayNumber != null) return `Day ${d.dayNumber}`;
  return 'Day';
}

export function dayChip(d: Pick<PlanDay, 'dayNumber' | 'weekday'>): string {
  if (d.weekday != null) return WEEK.find((w) => w.n === d.weekday)?.short ?? '—';
  return String(d.dayNumber ?? '—').padStart(2, '0');
}

const fmtMin = (s: number) => {
  const m = Math.round(s / 60);
  return m >= 60 && m % 60 === 0 ? `${m / 60} hr` : `${m} min`;
};

/** Short, human summary of a plan item's optional targets, e.g. "3 sets · 8–10 reps". */
export function targetSummary(it: PlanItem): string {
  const parts: string[] = [];
  if (it.targetSets) parts.push(`${it.targetSets} ${it.targetSets === 1 ? 'set' : 'sets'}`);
  if (it.targetReps) parts.push(`${it.targetReps} reps`);
  if (it.targetIntervals?.rounds)
    parts.push(
      `${it.targetIntervals.rounds}× ${fmtSec(it.targetIntervals.workS)} / ${fmtSec(it.targetIntervals.restS)} rest`,
    );
  if (it.targetDurationS) parts.push(fmtMin(it.targetDurationS));
  if (it.targetDistanceMi) parts.push(`${it.targetDistanceMi} mi`);
  if (it.targetZone) parts.push(`zone ${it.targetZone}`);
  if (it.targetNote) parts.push(it.targetNote);
  return parts.join(' · ');
}

export function fmtSec(s: number): string {
  if (!s) return '0s';
  if (s % 60 === 0) return `${s / 60} min`;
  return s > 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}
