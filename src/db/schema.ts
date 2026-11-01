/**
 * Local database (IndexedDB via Dexie). The phone is the source of truth:
 * every write lands here first; Phase 3 adds a sync queue to Supabase.
 *
 * Conventions (see docs/plan.md §4–5):
 * - client-generated UUID ids
 * - updatedAt on every write (last-write-wins sync)
 * - soft delete via deletedAt — nothing is ever hard-deleted from the UI
 */
import Dexie, { type EntityTable } from 'dexie';
import { seedStarterWorkouts, seedTypes } from './seed';

export type LogFormat = 'sets_weighted' | 'sets_bodyweight' | 'time_distance' | 'time_effort';
export type CadenceMode = 'weekdays' | 'day_number';
export type BlockType = 'straight' | 'superset' | 'pre_exhaust';
export type ItemRole = 'warmup' | 'pre_exhaust' | 'working';
export type SetKind = 'warmup' | 'working' | 'drop' | 'negative';
export type SkipReason = 'sore_injury' | 'equipment' | 'time' | 'energy' | 'other';
export type Rating = 1 | 2 | 3 | 4 | 5;

export interface Base {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
}

export interface WorkoutType extends Base {
  name: string;
  defaultLogFormat: LogFormat;
  order: number;
  archived: boolean;
  isSeeded: boolean;
}

export interface Workout extends Base {
  typeId: string;
  name: string;
  logFormatOverride?: LogFormat | null;
  notes?: string;
  archived: boolean;
  isStarter?: boolean;
}

export interface Plan extends Base {
  name: string;
  status: 'active' | 'draft' | 'archived';
  cadenceMode: CadenceMode;
  anchorDate?: string | null; // YYYY-MM-DD, day_number plans only
}

export interface PlanDay extends Base {
  planId: string;
  order: number;
  dayNumber?: number | null; // day_number plans
  weekday?: number | null; // 0 (Sun) – 6 (Sat), weekday plans
  label?: string;
}

export interface PlanSegment extends Base {
  planDayId: string;
  typeId: string;
  order: number;
}

export interface PlanBlock extends Base {
  segmentId: string;
  order: number;
  blockType: BlockType;
}

export interface Intervals {
  workS: number;
  restS: number;
  rounds: number;
}

export interface PlanItem extends Base {
  blockId: string;
  workoutId: string;
  order: number;
  role: ItemRole;
  targetSets?: number | null;
  targetReps?: string | null; // e.g. "8–10"
  targetDurationS?: number | null;
  targetDistanceMi?: number | null;
  targetZone?: string | null;
  targetIntervals?: Intervals | null;
  targetNote?: string | null;
}

export interface DailyCheckin extends Base {
  date: string; // YYYY-MM-DD, one per day
  sleep?: Rating | null;
  mood?: Rating | null;
  motivation?: Rating | null;
  note?: string;
}

export type SessionStatus = 'in_progress' | 'done' | 'skipped';
export type EntryStatus = 'pending' | 'done' | 'skipped';

export interface Session extends Base {
  date: string;
  startedAt?: number | null;
  endedAt?: number | null;
  planDayId?: string | null;
  status: SessionStatus;
  skipReason?: SkipReason | null;
  skipNote?: string | null;
  joyStart?: Rating | null;
  joyEnd?: Rating | null;
  note?: string;
}

export interface SessionBlock extends Base {
  sessionId: string;
  order: number;
  blockType: BlockType;
}

export interface SessionEntry extends Base {
  sessionId: string; // denormalized for fast session loads
  sessionBlockId: string;
  workoutId: string;
  planItemId?: string | null; // the plan item it came from (for target guidance)
  date: string; // denormalized for "last time" lookups
  order: number;
  role: ItemRole;
  status: EntryStatus;
  skipReason?: SkipReason | null;
  skipNote?: string | null;
}

export interface WorkSet extends Base {
  entryId: string;
  order: number;
  kind: SetKind;
  weightLb?: number | null;
  reps?: number | null;
  toFailure?: boolean;
  parentSetId?: string | null; // drop / negative chains
}

export interface TimedDetail extends Base {
  entryId: string;
  durationS?: number | null;
  distanceMi?: number | null;
  zone?: string | null;
  intervals?: Intervals | null;
}

export interface EffortDetail extends Base {
  entryId: string;
  durationS?: number | null;
  effort?: Rating | null;
  note?: string;
}

export class MovementDB extends Dexie {
  workoutTypes!: EntityTable<WorkoutType, 'id'>;
  workouts!: EntityTable<Workout, 'id'>;
  plans!: EntityTable<Plan, 'id'>;
  planDays!: EntityTable<PlanDay, 'id'>;
  planSegments!: EntityTable<PlanSegment, 'id'>;
  planBlocks!: EntityTable<PlanBlock, 'id'>;
  planItems!: EntityTable<PlanItem, 'id'>;
  dailyCheckins!: EntityTable<DailyCheckin, 'id'>;
  sessions!: EntityTable<Session, 'id'>;
  sessionBlocks!: EntityTable<SessionBlock, 'id'>;
  sessionEntries!: EntityTable<SessionEntry, 'id'>;
  sets!: EntityTable<WorkSet, 'id'>;
  timedDetails!: EntityTable<TimedDetail, 'id'>;
  effortDetails!: EntityTable<EffortDetail, 'id'>;

  constructor() {
    super('movement');
    this.version(1).stores({
      workoutTypes: 'id, order, updatedAt',
      workouts: 'id, typeId, updatedAt',
      plans: 'id, status, updatedAt',
      planDays: 'id, planId, updatedAt',
      planSegments: 'id, planDayId, updatedAt',
      planBlocks: 'id, segmentId, updatedAt',
      planItems: 'id, blockId, workoutId, updatedAt',
      dailyCheckins: 'id, &date, updatedAt',
      sessions: 'id, date, planDayId, status, updatedAt',
      sessionBlocks: 'id, sessionId, updatedAt',
      sessionEntries: 'id, sessionId, sessionBlockId, [workoutId+date], updatedAt',
      sets: 'id, entryId, updatedAt',
      timedDetails: 'id, entryId, updatedAt',
      effortDetails: 'id, entryId, updatedAt',
    });

    // v2: starter workout library (also backfills devices installed on v1).
    this.version(2)
      .stores({ workouts: 'id, typeId, name, updatedAt' })
      .upgrade((tx) => seedStarterWorkouts(tx));

    this.on('populate', async (tx) => {
      await seedTypes(tx);
      await seedStarterWorkouts(tx);
    });
  }
}

export { SEEDED_TYPES } from './seed';

export const db = new MovementDB();

/** Ask iOS not to evict our data. Best-effort; installed PWAs are usually granted. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
