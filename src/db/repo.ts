/**
 * Data helpers. Every write stamps updatedAt (for Phase 3 sync); deletes are soft
 * (deletedAt) so anything can be undone — "nothing is ever locked" (plan §3.5).
 */
import {
  db,
  type Base,
  type BlockType,
  type CadenceMode,
  type ItemRole,
  type LogFormat,
  type Plan,
  type PlanBlock,
  type PlanDay,
  type PlanItem,
  type PlanSegment,
  type Workout,
  type WorkoutType,
} from './schema';
import { todayISO } from '../lib/date';

type New<T extends Base> = Omit<T, keyof Base>;

/** The slice of a Dexie table these helpers need (keeps generics simple across EntityTable types). */
interface Updatable {
  update(id: string, changes: object): unknown;
}
interface Writable<T> extends Updatable {
  add(row: T): unknown;
}

export const alive = <T extends Base>(r: T | undefined | null): r is T => !!r && !r.deletedAt;

function stamp<T extends Base>(data: New<T>): T {
  const now = Date.now();
  return { ...(data as object), id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null } as T;
}

export async function create<T extends Base>(table: Writable<T>, data: New<T>): Promise<T> {
  const row = stamp<T>(data);
  await table.add(row);
  return row;
}

/** Partial update. (Field names aren't type-checked here — Dexie's table generics don't infer cleanly.) */
export async function patch(table: Updatable, id: string, changes: Record<string, unknown>) {
  await table.update(id, { ...changes, updatedAt: Date.now() });
}

export async function softDelete(table: Updatable, ids: string | string[]) {
  const now = Date.now();
  for (const id of Array.isArray(ids) ? ids : [ids]) await table.update(id, { deletedAt: now, updatedAt: now });
}

export async function restore(table: Updatable, ids: string | string[]) {
  const now = Date.now();
  for (const id of Array.isArray(ids) ? ids : [ids]) await table.update(id, { deletedAt: null, updatedAt: now });
}

// ---------- Types & workouts ----------

export async function addType(name: string, defaultLogFormat: LogFormat) {
  const order = (await db.workoutTypes.count()) + 1;
  return create<WorkoutType>(db.workoutTypes, { name, defaultLogFormat, order, archived: false, isSeeded: false });
}

export async function addWorkout(typeId: string, name: string) {
  return create<Workout>(db.workouts, { typeId, name, logFormatOverride: null, notes: '', archived: false });
}

export function logFormatOf(w: Workout | undefined, t: WorkoutType | undefined): LogFormat {
  return w?.logFormatOverride ?? t?.defaultLogFormat ?? 'time_effort';
}

// ---------- Plans ----------

export async function createPlan(name = 'My plan', cadenceMode: CadenceMode = 'day_number') {
  return create<Plan>(db.plans, { name, status: 'draft', cadenceMode, anchorDate: null });
}

/** One active plan at a time; the previous active plan becomes a draft. Day 1 defaults to today. */
export async function activatePlan(planId: string) {
  await db.transaction('rw', db.plans, async () => {
    const actives = await db.plans.where('status').equals('active').toArray();
    for (const p of actives) if (p.id !== planId) await patch(db.plans, p.id, { status: 'draft' });
    const plan = await db.plans.get(planId);
    await patch(db.plans, planId, { status: 'active', anchorDate: plan?.anchorDate ?? todayISO() });
  });
}

export async function addDay(plan: Plan, weekday?: number) {
  const days = (await db.planDays.where('planId').equals(plan.id).toArray()).filter(alive);
  const order = days.length;
  return create<PlanDay>(db.planDays, {
    planId: plan.id,
    order,
    dayNumber: plan.cadenceMode === 'day_number' ? order + 1 : null,
    weekday: plan.cadenceMode === 'weekdays' ? (weekday ?? null) : null,
    label: '',
  });
}

/** Keeps day numbers contiguous (Day 1…N) after reorder/delete. */
export async function renumberDays(planId: string) {
  const days = (await db.planDays.where('planId').equals(planId).toArray()).filter(alive).sort((a, b) => a.order - b.order);
  const plan = await db.plans.get(planId);
  for (const [i, d] of days.entries()) {
    const dayNumber = plan?.cadenceMode === 'day_number' ? i + 1 : null;
    if (d.order !== i || d.dayNumber !== dayNumber) await patch(db.planDays, d.id, { order: i, dayNumber });
  }
}

export async function moveDay(planId: string, dayId: string, dir: -1 | 1) {
  const days = (await db.planDays.where('planId').equals(planId).toArray()).filter(alive).sort((a, b) => a.order - b.order);
  const i = days.findIndex((d) => d.id === dayId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= days.length) return;
  await patch(db.planDays, days[i].id, { order: j });
  await patch(db.planDays, days[j].id, { order: i });
  await renumberDays(planId);
}

export async function addSegment(planDayId: string, typeId: string) {
  const order = (await db.planSegments.where('planDayId').equals(planDayId).toArray()).filter(alive).length;
  return create<PlanSegment>(db.planSegments, { planDayId, typeId, order });
}

/** Adds workouts to a segment, each as its own straight block. */
export async function addItems(segmentId: string, workoutIds: string[]) {
  let order = (await db.planBlocks.where('segmentId').equals(segmentId).toArray()).filter(alive).length;
  for (const workoutId of workoutIds) {
    const block = await create<PlanBlock>(db.planBlocks, { segmentId, order: order++, blockType: 'straight' });
    await create<PlanItem>(db.planItems, { blockId: block.id, workoutId, order: 0, role: 'working' });
  }
}

/**
 * Groups items into one superset / pre-exhaust block, in the order given.
 * Their old blocks are soft-deleted (restorable).
 */
export async function groupItems(segmentId: string, itemIds: string[], blockType: BlockType) {
  const items = (await db.planItems.bulkGet(itemIds)).filter(alive);
  if (items.length < 2) return;
  const oldBlocks = (await db.planBlocks.bulkGet(items.map((i) => i.blockId))).filter(alive);
  const order = Math.min(...oldBlocks.map((b) => b.order));
  const block = await create<PlanBlock>(db.planBlocks, { segmentId, order, blockType });
  const roles: ItemRole[] =
    blockType === 'pre_exhaust' ? ['pre_exhaust', ...Array(items.length - 1).fill('working')] : Array(items.length).fill('working');
  for (const [i, it] of items.entries()) await patch(db.planItems, it.id, { blockId: block.id, order: i, role: roles[i] });
  const emptied = [];
  for (const b of oldBlocks) {
    const left = (await db.planItems.where('blockId').equals(b.id).toArray()).filter(alive);
    if (!left.length) emptied.push(b.id);
  }
  await softDelete(db.planBlocks, emptied);
}

/** Splits a grouped block back into straight blocks. */
export async function ungroupBlock(blockId: string) {
  const block = await db.planBlocks.get(blockId);
  if (!block) return;
  const items = (await db.planItems.where('blockId').equals(blockId).toArray()).filter(alive).sort((a, b) => a.order - b.order);
  for (const [i, it] of items.entries()) {
    if (i === 0) continue;
    const nb = await create<PlanBlock>(db.planBlocks, { segmentId: block.segmentId, order: block.order + i * 0.01, blockType: 'straight' });
    await patch(db.planItems, it.id, { blockId: nb.id, order: 0, role: 'working' });
  }
  await patch(db.planBlocks, blockId, { blockType: 'straight' });
  if (items[0]) await patch(db.planItems, items[0].id, { role: 'working' });
  await renumberBlocks(block.segmentId);
}

/** Pre-exhaustion template: compound warm-up → isolation → same compound working. */
export async function addPreExhaustTemplate(segmentId: string, compoundId: string, isolationId: string) {
  const order = (await db.planBlocks.where('segmentId').equals(segmentId).toArray()).filter(alive).length;
  const block = await create<PlanBlock>(db.planBlocks, { segmentId, order, blockType: 'pre_exhaust' });
  const seq: [string, ItemRole][] = [
    [compoundId, 'warmup'],
    [isolationId, 'pre_exhaust'],
    [compoundId, 'working'],
  ];
  for (const [i, [workoutId, role]] of seq.entries()) await create<PlanItem>(db.planItems, { blockId: block.id, workoutId, order: i, role });
}

export async function renumberBlocks(segmentId: string) {
  const blocks = (await db.planBlocks.where('segmentId').equals(segmentId).toArray()).filter(alive).sort((a, b) => a.order - b.order);
  for (const [i, b] of blocks.entries()) if (b.order !== i) await patch(db.planBlocks, b.id, { order: i });
}

export async function moveBlock(segmentId: string, blockId: string, dir: -1 | 1) {
  await renumberBlocks(segmentId);
  const blocks = (await db.planBlocks.where('segmentId').equals(segmentId).toArray()).filter(alive).sort((a, b) => a.order - b.order);
  const i = blocks.findIndex((b) => b.id === blockId);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= blocks.length) return;
  await patch(db.planBlocks, blocks[i].id, { order: j });
  await patch(db.planBlocks, blocks[j].id, { order: i });
}

/** Removes one item; if its block empties, the block goes too. Returns an undo function. */
export async function removeItem(item: PlanItem): Promise<() => Promise<void>> {
  await softDelete(db.planItems, item.id);
  const left = (await db.planItems.where('blockId').equals(item.blockId).toArray()).filter(alive);
  const block = await db.planBlocks.get(item.blockId);
  let blockRemoved = false;
  if (!left.length) {
    await softDelete(db.planBlocks, item.blockId);
    blockRemoved = true;
  } else if (left.length === 1 && block && block.blockType !== 'straight') {
    await patch(db.planBlocks, block.id, { blockType: 'straight' });
  }
  return async () => {
    await restore(db.planItems, item.id);
    if (blockRemoved) await restore(db.planBlocks, item.blockId);
    else if (block && block.blockType !== 'straight') await patch(db.planBlocks, block.id, { blockType: block.blockType });
  };
}

/** Deep-copies a day (segments, blocks, items) to the end of the plan. */
export async function duplicateDay(plan: Plan, dayId: string) {
  const src = await db.planDays.get(dayId);
  if (!src) return;
  const copy = await addDay(plan, plan.cadenceMode === 'weekdays' ? undefined : undefined);
  await patch(db.planDays, copy.id, { label: src.label ? `${src.label} (copy)` : '' });
  const segs = (await db.planSegments.where('planDayId').equals(dayId).toArray()).filter(alive);
  for (const s of segs) {
    const ns = await create<PlanSegment>(db.planSegments, { planDayId: copy.id, typeId: s.typeId, order: s.order });
    const blocks = (await db.planBlocks.where('segmentId').equals(s.id).toArray()).filter(alive);
    for (const b of blocks) {
      const nb = await create<PlanBlock>(db.planBlocks, { segmentId: ns.id, order: b.order, blockType: b.blockType });
      const items = (await db.planItems.where('blockId').equals(b.id).toArray()).filter(alive);
      for (const it of items) {
        const { id: _i, createdAt: _c, updatedAt: _u, deletedAt: _d, ...rest } = it;
        await create<PlanItem>(db.planItems, { ...rest, blockId: nb.id });
      }
    }
  }
  return copy;
}

// ---------- Reading a whole plan ----------

export interface ItemNode extends PlanItem {
  workout?: Workout;
}
export interface BlockNode extends PlanBlock {
  items: ItemNode[];
}
export interface SegmentNode extends PlanSegment {
  type?: WorkoutType;
  blocks: BlockNode[];
}
export interface DayNode extends PlanDay {
  segments: SegmentNode[];
}

export async function loadDay(dayId: string): Promise<DayNode | null> {
  const day = await db.planDays.get(dayId);
  if (!alive(day)) return null;
  // Sequential awaits on purpose: a native Promise.all breaks Dexie's liveQuery tracking for later reads.
  const types = await db.workoutTypes.toArray();
  const workouts = await db.workouts.toArray();
  const typeMap = new Map(types.map((t) => [t.id, t]));
  const wMap = new Map(workouts.map((w) => [w.id, w]));
  const segs = (await db.planSegments.where('planDayId').equals(dayId).toArray()).filter(alive).sort((a, b) => a.order - b.order);
  const segments: SegmentNode[] = [];
  for (const s of segs) {
    const blocks = (await db.planBlocks.where('segmentId').equals(s.id).toArray()).filter(alive).sort((a, b) => a.order - b.order);
    const blockNodes: BlockNode[] = [];
    for (const b of blocks) {
      const items = (await db.planItems.where('blockId').equals(b.id).toArray())
        .filter(alive)
        .sort((x, y) => x.order - y.order)
        .map((it) => ({ ...it, workout: wMap.get(it.workoutId) }));
      if (items.length) blockNodes.push({ ...b, items });
    }
    segments.push({ ...s, type: typeMap.get(s.typeId), blocks: blockNodes });
  }
  return { ...day, segments };
}

export async function loadPlanDays(planId: string): Promise<DayNode[]> {
  const days = (await db.planDays.where('planId').equals(planId).toArray()).filter(alive);
  const plan = await db.plans.get(planId);
  const sorted =
    plan?.cadenceMode === 'weekdays'
      ? days.sort((a, b) => weekdayRank(a.weekday) - weekdayRank(b.weekday))
      : days.sort((a, b) => a.order - b.order);
  const out: DayNode[] = [];
  for (const d of sorted) {
    const node = await loadDay(d.id);
    if (node) out.push(node);
  }
  return out;
}

/** Monday-first ordering for weekday plans. */
export const weekdayRank = (w?: number | null) => (w == null ? 99 : (w + 6) % 7);

/**
 * Switches a plan's cadence without mixing modes.
 * Day numbers → weekdays: the first seven days map to Mon…Sun; any extras are left unassigned.
 * Weekdays → day numbers: days are numbered in Monday-first order.
 */
export async function convertCadence(planId: string, to: CadenceMode) {
  const plan = await db.plans.get(planId);
  if (!plan || plan.cadenceMode === to) return;
  const days = (await db.planDays.where('planId').equals(planId).toArray()).filter(alive);
  if (to === 'weekdays') {
    const sorted = days.sort((a, b) => a.order - b.order);
    const week = [1, 2, 3, 4, 5, 6, 0];
    for (const [i, d] of sorted.entries()) await patch(db.planDays, d.id, { weekday: week[i] ?? null, dayNumber: null });
  } else {
    const sorted = days.sort((a, b) => weekdayRank(a.weekday) - weekdayRank(b.weekday));
    for (const [i, d] of sorted.entries()) await patch(db.planDays, d.id, { order: i, dayNumber: i + 1, weekday: null });
  }
  await patch(db.plans, planId, { cadenceMode: to });
}
