import type { Transaction } from 'dexie';
import type { LogFormat } from './schema';

export const SEEDED_TYPES: ReadonlyArray<readonly [string, LogFormat]> = [
  ['Resistance', 'sets_weighted'],
  ['Cardio', 'time_distance'],
  ['Plyometrics', 'sets_bodyweight'],
  ['Flexibility', 'time_effort'],
  ['Rest', 'time_effort'],
  ['Blue Collar', 'time_effort'],
];

/**
 * Optional starter library so the first plan isn't built from an empty list.
 * Everything here can be renamed or archived; users add their own variations.
 * A [name, logFormatOverride] pair overrides the type's default log format.
 */
export const STARTER_WORKOUTS: Record<string, ReadonlyArray<string | readonly [string, LogFormat]>> = {
  Resistance: [
    'Back squat',
    'Front squat',
    'Split squat',
    'Romanian deadlift',
    'Single-leg deadlift',
    'Calf raise',
    'Tib raise',
    'Bench press',
    'Incline dumbbell press',
    'Incline dumbbell fly',
    'Overhead press',
    'Weighted pull-up (palms facing)',
    'Barbell row',
    'Bicep curl',
    'Tricep extension',
  ],
  Cardio: ['Cycling', 'Running', 'Walking', 'Sprints', 'Norwegian 4x4', 'Rowing'],
  Plyometrics: ['Box jump', 'Broad jump', 'Jump squat', 'Skater bound', 'Depth jump'],
  Flexibility: ['Yoga', 'Mobility flow', 'Stretching'],
  Rest: [['Walking', 'time_distance'], 'Wim Hof breathing', 'Yoga', 'Sauna'],
  'Blue Collar': ['Farm work', 'House project', 'Yard work', 'Construction'],
};

const base = () => {
  const now = Date.now();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null };
};

export async function seedTypes(tx: Transaction) {
  await tx.table('workoutTypes').bulkAdd(
    SEEDED_TYPES.map(([name, defaultLogFormat], order) => ({
      ...base(),
      name,
      defaultLogFormat,
      order,
      archived: false,
      isSeeded: true,
    })),
  );
}

/** Adds starter workouts to any seeded type that has none yet. Safe to run more than once. */
export async function seedStarterWorkouts(tx: Transaction) {
  const types = await tx.table('workoutTypes').toArray();
  const existing = await tx.table('workouts').toArray();
  const rows = [];
  for (const t of types) {
    const starters = STARTER_WORKOUTS[t.name];
    if (!starters || existing.some((w) => w.typeId === t.id)) continue;
    for (const s of starters) {
      const [name, override] = typeof s === 'string' ? [s, null] : s;
      rows.push({ ...base(), typeId: t.id, name, logFormatOverride: override, notes: '', archived: false, isStarter: true });
    }
  }
  if (rows.length) await tx.table('workouts').bulkAdd(rows);
}
