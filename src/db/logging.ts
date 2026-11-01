/**
 * Logging (Phase 2): sessions, entries, sets, details, skips, daily check-ins, next-up.
 * Same rules as repo.ts: local-first, updatedAt on every write, soft deletes, nothing locked.
 */
import Dexie from 'dexie';
import { alive, create, loadDay, loadPlanDays, logFormatOf, patch, restore, softDelete, type DayNode } from './repo';
import {
  db,
  type BlockType,
  type DailyCheckin,
  type EffortDetail,
  type ItemRole,
  type LogFormat,
  type Plan,
  type PlanItem,
  type Session,
  type SessionBlock,
  type SessionEntry,
  type SetKind,
  type SkipReason,
  type TimedDetail,
  type Workout,
  type WorkoutType,
  type WorkSet,
} from './schema';
import { daysBetween, todayISO } from '../lib/date';

// ---------- Daily check-in (once per day, editable anytime) ----------

export async function setCheckin(date: string, changes: Partial<Pick<DailyCheckin, 'sleep' | 'mood' | 'motivation' | 'note'>>) {
  const existing = await db.dailyCheckins.where('date').equals(date).first();
  if (existing) await patch(db.dailyCheckins, existing.id, { ...changes, deletedAt: null });
  else await create<DailyCheckin>(db.dailyCheckins, { date, sleep: null, mood: null, motivation: null, note: '', ...changes });
}

// ---------- Starting sessions ----------

/** Copies a plan day's blocks and items into a new session (targets stay on the plan items). */
export async function startSessionFromDay(planDayId: string, date = todayISO()): Promise<Session> {
  const day = await loadDay(planDayId);
  const session = await create<Session>(db.sessions, {
    date,
    startedAt: Date.now(),
    endedAt: null,
    planDayId,
    status: 'in_progress',
    joyStart: null,
    joyEnd: null,
    note: '',
  });
  let order = 0;
  for (const seg of day?.segments ?? []) {
    for (const b of seg.blocks) {
      const sb = await create<SessionBlock>(db.sessionBlocks, { sessionId: session.id, order: order++, blockType: b.blockType });
      for (const [i, it] of b.items.entries()) {
        await create<SessionEntry>(db.sessionEntries, {
          sessionId: session.id,
          sessionBlockId: sb.id,
          workoutId: it.workoutId,
          planItemId: it.id,
          date,
          order: i,
          role: it.role,
          status: 'pending',
        });
      }
    }
  }
  return session;
}

/** Off-plan: log any single workout from the library. */
export async function startSingleWorkout(workoutId: string, date = todayISO()): Promise<Session> {
  const session = await create<Session>(db.sessions, {
    date,
    startedAt: Date.now(),
    endedAt: null,
    planDayId: null,
    status: 'in_progress',
    joyStart: null,
    joyEnd: null,
    note: '',
  });
  await addEntryToSession(session.id, workoutId);
  return session;
}

export async function addEntryToSession(sessionId: string, workoutId: string, blockType: BlockType = 'straight', role: ItemRole = 'working') {
  const session = await db.sessions.get(sessionId);
  const order = (await db.sessionBlocks.where('sessionId').equals(sessionId).toArray()).filter(alive).length;
  const sb = await create<SessionBlock>(db.sessionBlocks, { sessionId, order, blockType });
  return create<SessionEntry>(db.sessionEntries, {
    sessionId,
    sessionBlockId: sb.id,
    workoutId,
    date: session?.date ?? todayISO(),
    order: 0,
    role,
    status: 'pending',
  });
}

/** A whole planned day skipped on purpose (counts for "next in sequence"). */
export async function skipDay(planDayId: string, reason: SkipReason | null, note: string, date = todayISO()) {
  return create<Session>(db.sessions, {
    date,
    startedAt: null,
    endedAt: null,
    planDayId,
    status: 'skipped',
    skipReason: reason,
    skipNote: note || null,
    joyStart: null,
    joyEnd: null,
    note: '',
  });
}

// ---------- Sets & details ----------

export async function addSet(entryId: string, kind: SetKind, prefill: Partial<WorkSet> = {}) {
  const existing = (await db.sets.where('entryId').equals(entryId).toArray()).filter(alive);
  const prev = existing.sort((a, b) => a.order - b.order).at(-1);
  return create<WorkSet>(db.sets, {
    entryId,
    order: existing.length,
    kind,
    weightLb: prefill.weightLb ?? null,
    reps: prefill.reps ?? null,
    toFailure: false,
    parentSetId: kind === 'drop' || kind === 'negative' ? (prev?.id ?? null) : null,
  });
}

export async function upsertTimed(entryId: string, changes: Partial<TimedDetail>) {
  const d = (await db.timedDetails.where('entryId').equals(entryId).toArray()).find(alive);
  if (d) await patch(db.timedDetails, d.id, changes);
  else await create<TimedDetail>(db.timedDetails, { entryId, durationS: null, distanceMi: null, zone: null, intervals: null, ...changes });
}

export async function upsertEffort(entryId: string, changes: Partial<EffortDetail>) {
  const d = (await db.effortDetails.where('entryId').equals(entryId).toArray()).find(alive);
  if (d) await patch(db.effortDetails, d.id, changes);
  else await create<EffortDetail>(db.effortDetails, { entryId, durationS: null, effort: null, note: '', ...changes });
}

// ---------- "Last time" ----------

export interface LastTime {
  date: string;
  sets: WorkSet[];
  timed?: TimedDetail;
  effort?: EffortDetail;
}

/** The most recent *done* entry for this workout (skips are ignored), excluding the current session. */
export async function lastTime(workoutId: string, excludeSessionId?: string): Promise<LastTime | null> {
  const entries = (
    await db.sessionEntries
      .where('[workoutId+date]')
      .between([workoutId, Dexie.minKey], [workoutId, Dexie.maxKey])
      .toArray()
  ).filter((e) => alive(e) && e.status === 'done' && e.sessionId !== excludeSessionId);
  if (!entries.length) return null;
  // Ignore entries whose session was deleted.
  const sessions = new Map((await db.sessions.bulkGet(entries.map((e) => e.sessionId))).filter(alive).map((s) => [s.id, s]));
  const live = entries.filter((e) => sessions.has(e.sessionId)).sort((a, b) => (a.date === b.date ? b.updatedAt - a.updatedAt : a.date < b.date ? 1 : -1));
  const e = live[0];
  if (!e) return null;
  const sets = await db.sets.where('entryId').equals(e.id).toArray();
  const timed = await db.timedDetails.where('entryId').equals(e.id).toArray();
  const effort = await db.effortDetails.where('entryId').equals(e.id).toArray();
  return {
    date: e.date,
    sets: sets.filter(alive).sort((a, b) => a.order - b.order),
    timed: timed.find(alive),
    effort: effort.find(alive),
  };
}

// ---------- Reading a session ----------

export interface EntryNode extends SessionEntry {
  workout?: Workout;
  type?: WorkoutType;
  format: LogFormat;
  planItem?: PlanItem;
  sets: WorkSet[];
  timed?: TimedDetail;
  effort?: EffortDetail;
}
export interface SessionBlockNode extends SessionBlock {
  entries: EntryNode[];
}
export interface SessionNode extends Session {
  blocks: SessionBlockNode[];
  day?: DayNode | null;
}

export async function loadSession(sessionId: string): Promise<SessionNode | null> {
  const s = await db.sessions.get(sessionId);
  if (!alive(s)) return null;
  // Sequential awaits on purpose: a native Promise.all breaks Dexie's liveQuery tracking for later reads.
  const types = await db.workoutTypes.toArray();
  const workouts = await db.workouts.toArray();
  const tMap = new Map(types.map((t) => [t.id, t]));
  const wMap = new Map(workouts.map((w) => [w.id, w]));
  const blocks = (await db.sessionBlocks.where('sessionId').equals(sessionId).toArray()).filter(alive).sort((a, b) => a.order - b.order);
  const entries = (await db.sessionEntries.where('sessionId').equals(sessionId).toArray()).filter(alive);
  const ids = entries.map((e) => e.id);
  const sets = await db.sets.where('entryId').anyOf(ids).toArray();
  const timed = await db.timedDetails.where('entryId').anyOf(ids).toArray();
  const effort = await db.effortDetails.where('entryId').anyOf(ids).toArray();
  const planItems = await db.planItems.bulkGet(entries.map((e) => e.planItemId ?? ''));
  const piMap = new Map(planItems.filter(Boolean).map((p) => [p!.id, p!]));
  const out: SessionBlockNode[] = blocks.map((b) => ({
    ...b,
    entries: entries
      .filter((e) => e.sessionBlockId === b.id)
      .sort((x, y) => x.order - y.order)
      .map((e) => {
        const workout = wMap.get(e.workoutId);
        const type = workout ? tMap.get(workout.typeId) : undefined;
        return {
          ...e,
          workout,
          type,
          format: logFormatOf(workout, type),
          planItem: piMap.get(e.planItemId ?? ''),
          sets: sets.filter((x) => alive(x) && x.entryId === e.id).sort((a, b) => a.order - b.order),
          timed: timed.find((x) => alive(x) && x.entryId === e.id),
          effort: effort.find((x) => alive(x) && x.entryId === e.id),
        };
      }),
  }));
  const day = s.planDayId ? await loadDay(s.planDayId) : null;
  return { ...s, blocks: out.filter((b) => b.entries.length), day };
}

/** Moving a session to another date keeps its entries' dates in step ("last time" uses them). */
export async function setSessionDate(sessionId: string, date: string) {
  await patch(db.sessions, sessionId, { date });
  const entries = await db.sessionEntries.where('sessionId').equals(sessionId).toArray();
  for (const e of entries) await patch(db.sessionEntries, e.id, { date });
}

export async function deleteSession(sessionId: string) {
  await softDelete(db.sessions, sessionId);
  return () => restore(db.sessions, sessionId);
}

// ---------- Next up ----------

export interface NextUp {
  plan: Plan;
  days: DayNode[];
  /** Day-number plans: the day after the last plan day logged or skipped. */
  inSequence?: DayNode;
  /** Day-number plans: where the calendar says you are (from the anchor date). */
  onSchedule?: DayNode;
  /** Weekday plans: today's entry (may be undefined if nothing planned today). */
  today?: DayNode;
  /** Plan sessions already logged/skipped today. */
  doneToday: Session[];
}

/**
 * Always derived from the log — never stored — so undoing a skip or editing a past
 * session immediately corrects it (plan §3.5).
 */
export async function computeNextUp(): Promise<NextUp | null> {
  const plan = (await db.plans.where('status').equals('active').toArray()).find(alive);
  if (!plan) return null;
  const days = await loadPlanDays(plan.id);
  const dayIds = new Set(days.map((d) => d.id));
  const sessions = (await db.sessions.toArray()).filter((s) => alive(s) && s.planDayId && dayIds.has(s.planDayId));
  const today = todayISO();
  const doneToday = sessions.filter((s) => s.date === today);

  if (plan.cadenceMode === 'weekdays') {
    const wd = new Date().getDay();
    return { plan, days, today: days.find((d) => d.weekday === wd), doneToday };
  }

  if (!days.length) return { plan, days, doneToday };
  const sorted = [...sessions].sort((a, b) => (a.date === b.date ? (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt) : a.date < b.date ? 1 : -1));
  const last = sorted[0];
  const lastIdx = last ? days.findIndex((d) => d.id === last.planDayId) : -1;
  const inSequence = days[(lastIdx + 1) % days.length];
  const anchor = plan.anchorDate ?? today;
  const diff = daysBetween(anchor, today);
  const onSchedule = days[((diff % days.length) + days.length) % days.length];
  return { plan, days, inSequence, onSchedule, doneToday };
}

export async function sessionsOn(date: string) {
  return (await db.sessions.where('date').equals(date).toArray()).filter(alive).sort((a, b) => (a.startedAt ?? a.createdAt) - (b.startedAt ?? b.createdAt));
}
