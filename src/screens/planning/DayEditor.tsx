import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AutoNumber, AutoText, ScreenHead, Segmented, Sheet } from '../../components/ui';
import { useUndo } from '../../components/Undo';
import {
  addItems,
  addPreExhaustTemplate,
  addSegment,
  addWorkout,
  alive,
  groupItems,
  loadDay,
  logFormatOf,
  moveBlock,
  patch,
  removeItem,
  restore,
  softDelete,
  ungroupBlock,
  type ItemNode,
  type SegmentNode,
} from '../../db/repo';
import { db, type BlockType, type ItemRole, type LogFormat } from '../../db/schema';
import { BLOCK_LABEL, dayTitle, LOG_FORMAT_LABEL, ROLE_LABEL, targetSummary, WEEK } from '../../lib/format';
import './planning.css';

export function DayEditor() {
  const { planId = '', dayId = '' } = useParams();
  const undo = useUndo();
  const plan = useLiveQuery(() => db.plans.get(planId), [planId]);
  const day = useLiveQuery(() => loadDay(dayId), [dayId]);
  const otherWeekdays = useLiveQuery(
    async () =>
      new Set(
        (await db.planDays.where('planId').equals(planId).toArray())
          .filter((d) => alive(d) && d.id !== dayId)
          .map((d) => d.weekday),
      ),
    [planId, dayId],
  );
  const types = useLiveQuery(() => db.workoutTypes.orderBy('order').filter((t) => alive(t) && !t.archived).toArray(), []);
  const [typePicker, setTypePicker] = useState(false);
  const [picker, setPicker] = useState<{ typeId: string; segmentId?: string } | null>(null);
  const [editItem, setEditItem] = useState<{ item: ItemNode; format: LogFormat; inGroup: boolean } | null>(null);

  if (plan === undefined || day === undefined) return null;
  if (!plan || !day)
    return (
      <div className="screen">
        <ScreenHead title="Not found" back={`/settings/planning/plan/${planId}`} />
      </div>
    );

  const isWeek = plan.cadenceMode === 'weekdays';

  async function onPicked(ids: string[]) {
    const p = picker!;
    setPicker(null);
    if (!ids.length) return;
    const segId = p.segmentId ?? (await addSegment(dayId, p.typeId)).id;
    await addItems(segId, ids);
  }

  async function removeSegment(s: SegmentNode) {
    await softDelete(db.planSegments, s.id);
    undo(`${s.type?.name ?? 'Type'} removed from ${dayTitle(day!)}`, () => restore(db.planSegments, s.id));
  }

  return (
    <div className="screen">
      <ScreenHead title={dayTitle(day)} label={plan.name} back={`/settings/planning/plan/${planId}`} />

      <div className="stack">
        {isWeek && (
          <div className="field-row">
            <span className="label">Weekday</span>
            <div className="chips">
              {WEEK.map((w) => (
                <button
                  key={w.n}
                  className={`chip ${day.weekday === w.n ? 'on' : ''}`}
                  disabled={otherWeekdays?.has(w.n)}
                  onClick={() => patch(db.planDays, dayId, { weekday: w.n })}
                >
                  {w.short}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="field-row">
          <span className="label">Label (optional)</span>
          <AutoText value={day.label ?? ''} onSave={(v) => patch(db.planDays, dayId, { label: v })} placeholder="e.g. Legs, Zone 2, Rest" />
        </label>
      </div>

      {day.segments.map((s) => (
        <SegmentCard
          key={s.id}
          segment={s}
          onAddWorkouts={() => setPicker({ typeId: s.typeId, segmentId: s.id })}
          onRemove={() => removeSegment(s)}
          onEditItem={(item, format, inGroup) => setEditItem({ item, format, inGroup })}
        />
      ))}

      <button className="btn btn-ghost btn-block" style={{ marginTop: 'var(--space-5)' }} onClick={() => setTypePicker(true)}>
        + Add a type to this day
      </button>
      <p className="hint" style={{ marginTop: 'var(--space-2)' }}>
        A day can mix types — e.g. Resistance and Plyometrics, or Rest with a walk and yoga.
      </p>

      <Sheet open={typePicker} onClose={() => setTypePicker(false)} title="Pick a type">
        <ul className="rows">
          {types?.map((t) => (
            <li key={t.id}>
              <button
                className="row"
                onClick={() => {
                  setTypePicker(false);
                  const existing = day.segments.find((s) => s.typeId === t.id);
                  setPicker({ typeId: t.id, segmentId: existing?.id });
                }}
              >
                <span className="row-text">
                  <span className="row-title">{t.name}</span>
                  <span className="row-sub">{LOG_FORMAT_LABEL[t.defaultLogFormat]}</span>
                </span>
                <span className="chev" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {picker && <WorkoutPicker typeId={picker.typeId} onDone={onPicked} onCancel={() => setPicker(null)} />}
      {editItem && <ItemSheet {...editItem} onClose={() => setEditItem(null)} />}
    </div>
  );
}

// ---------- One type within a day ----------

function SegmentCard({
  segment: s,
  onAddWorkouts,
  onRemove,
  onEditItem,
}: {
  segment: SegmentNode;
  onAddWorkouts: () => void;
  onRemove: () => void;
  onEditItem: (item: ItemNode, format: LogFormat, inGroup: boolean) => void;
}) {
  const undo = useUndo();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [template, setTemplate] = useState(false);
  const isSets = s.type?.defaultLogFormat === 'sets_weighted' || s.type?.defaultLogFormat === 'sets_bodyweight';
  const itemCount = s.blocks.reduce((n, b) => n + b.items.length, 0);

  function toggle(id: string) {
    setSelected((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  }

  async function group(kind: BlockType) {
    await groupItems(s.id, selected, kind);
    setSelected([]);
    setSelecting(false);
  }

  return (
    <section className="seg-card">
      <header className="seg-head">
        <h2>{s.type?.name ?? 'Type'}</h2>
        <button className="link-btn danger" onClick={onRemove}>
          Remove
        </button>
      </header>

      {s.blocks.length === 0 && <p className="muted" style={{ padding: 'var(--space-3) 0' }}>No workouts yet.</p>}

      <ol className="blocks">
        {s.blocks.map((b, bi) => {
          const grouped = b.blockType !== 'straight';
          return (
            <li key={b.id} className={`block ${grouped ? 'grouped' : ''}`}>
              {grouped && (
                <div className="block-head">
                  <span className={`tag ${b.blockType === 'superset' ? 'tag-teal' : 'tag-accent'}`}>{BLOCK_LABEL[b.blockType]}</span>
                  <button className="link-btn" onClick={() => ungroupBlock(b.id)}>
                    Ungroup
                  </button>
                </div>
              )}
              {b.items.map((it) => {
                const format = logFormatOf(it.workout, s.type);
                const summary = targetSummary(it);
                return (
                  <div key={it.id} className="item">
                    {selecting && (
                      <button className="item-check" aria-label={`Select ${it.workout?.name}`} onClick={() => toggle(it.id)}>
                        <span className={`check ${selected.includes(it.id) ? 'on' : ''}`} />
                        {selected.includes(it.id) && <span className="sel-n">{selected.indexOf(it.id) + 1}</span>}
                      </button>
                    )}
                    <button className="item-main" onClick={() => (selecting ? toggle(it.id) : onEditItem(it, format, grouped))}>
                      <span className="item-name">
                        {it.workout?.name ?? 'Workout'}
                        {grouped && <span className="item-role"> · {ROLE_LABEL[it.role]}</span>}
                      </span>
                      <span className={`item-sub ${summary ? '' : 'muted'}`}>{summary || 'Add targets (optional)'}</span>
                    </button>
                    {!selecting && (
                      <button
                        className="icon-btn"
                        aria-label={`Remove ${it.workout?.name}`}
                        onClick={async () => {
                          const back = await removeItem(it);
                          undo(`${it.workout?.name ?? 'Workout'} removed`, back);
                        }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                );
              })}
              {!selecting && s.blocks.length > 1 && (
                <div className="block-move">
                  <button className="icon-btn" aria-label="Move up" disabled={bi === 0} onClick={() => moveBlock(s.id, b.id, -1)}>
                    ↑
                  </button>
                  <button className="icon-btn" aria-label="Move down" disabled={bi === s.blocks.length - 1} onClick={() => moveBlock(s.id, b.id, 1)}>
                    ↓
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {selecting ? (
        <div className="select-bar">
          <p className="hint">Tap workouts in the order you'll do them.</p>
          <div className="actions">
            <button className="btn btn-secondary btn-sm" disabled={selected.length < 2} onClick={() => group('superset')}>
              Superset
            </button>
            <button className="btn btn-secondary btn-sm" disabled={selected.length < 2} onClick={() => group('pre_exhaust')}>
              Pre-exhaust
            </button>
            <button
              className="link-btn"
              onClick={() => {
                setSelecting(false);
                setSelected([]);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="actions seg-actions">
          <button className="btn btn-secondary btn-sm" onClick={onAddWorkouts}>
            + Workouts
          </button>
          {isSets && itemCount >= 2 && (
            <button className="btn btn-secondary btn-sm" onClick={() => setSelecting(true)}>
              Group
            </button>
          )}
          {isSets && (
            <button className="btn btn-secondary btn-sm" onClick={() => setTemplate(true)}>
              Pre-exhaust template
            </button>
          )}
        </div>
      )}

      {template && <PreExhaustSheet segment={s} onClose={() => setTemplate(false)} />}
    </section>
  );
}

// ---------- Pick workouts from a type (multi-select, add new inline) ----------

function WorkoutPicker({ typeId, onDone, onCancel }: { typeId: string; onDone: (ids: string[]) => void; onCancel: () => void }) {
  const type = useLiveQuery(() => db.workoutTypes.get(typeId), [typeId]);
  const workouts = useLiveQuery(
    async () =>
      (await db.workouts.where('typeId').equals(typeId).toArray())
        .filter((w) => alive(w) && !w.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [typeId],
  );
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const query = q.trim().toLowerCase();
  const shown = useMemo(() => (workouts ?? []).filter((w) => w.name.toLowerCase().includes(query)), [workouts, query]);
  const exact = (workouts ?? []).some((w) => w.name.toLowerCase() === query);

  async function addNew() {
    const w = await addWorkout(typeId, q.trim());
    setSel((s) => [...s, w.id]);
    setQ('');
  }

  return (
    <Sheet
      open
      onClose={onCancel}
      title={type?.name ?? 'Workouts'}
      footer={
        <button className="btn btn-primary btn-block" disabled={!sel.length} onClick={() => onDone(sel)}>
          {sel.length ? `Add ${sel.length} ${sel.length === 1 ? 'workout' : 'workouts'}` : 'Select workouts'}
        </button>
      }
    >
      <input
        className="field"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search or add a workout"
        aria-label="Search or add a workout"
        onKeyDown={(e) => e.key === 'Enter' && query && !exact && addNew()}
      />
      {query && !exact && (
        <button className="row add-new" onClick={addNew}>
          <span className="row-title">
            + Add “{q.trim()}” to {type?.name}
          </span>
        </button>
      )}
      <ul className="rows" style={{ marginTop: 'var(--space-3)' }}>
        {shown.map((w) => {
          const on = sel.includes(w.id);
          return (
            <li key={w.id}>
              <button className="row" role="checkbox" aria-checked={on} onClick={() => setSel((s) => (on ? s.filter((x) => x !== w.id) : [...s, w.id]))}>
                <span className="row-title">{w.name}</span>
                <span className={`check ${on ? 'on' : ''}`} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {workouts && workouts.length === 0 && !query && <p className="muted">No workouts in this type yet — type a name above to add one.</p>}
    </Sheet>
  );
}

// ---------- Pre-exhaust template ----------

function PreExhaustSheet({ segment, onClose }: { segment: SegmentNode; onClose: () => void }) {
  const workouts = useLiveQuery(
    async () =>
      (await db.workouts.where('typeId').equals(segment.typeId).toArray())
        .filter((w) => alive(w) && !w.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [segment.typeId],
  );
  const [compound, setCompound] = useState<string | null>(null);
  const [isolation, setIsolation] = useState<string | null>(null);
  const step = compound ? 'isolation' : 'compound';
  const list = (workouts ?? []).filter((w) => step === 'compound' || w.id !== compound);

  return (
    <Sheet
      open
      onClose={onClose}
      title="Pre-exhaust"
      footer={
        <button
          className="btn btn-primary btn-block"
          disabled={!compound || !isolation}
          onClick={async () => {
            await addPreExhaustTemplate(segment.id, compound!, isolation!);
            onClose();
          }}
        >
          Add pre-exhaust block
        </button>
      }
    >
      <p className="muted" style={{ marginBottom: 'var(--space-3)' }}>
        Compound warm-up → isolation (pre-exhaust) → the same compound as your working set.
      </p>
      <p className="label">{step === 'compound' ? '1 · Pick the compound lift' : '2 · Pick the isolation move'}</p>
      {compound && (
        <button className="row" onClick={() => (setCompound(null), setIsolation(null))}>
          <span className="row-text">
            <span className="row-sub">Compound</span>
            <span className="row-title">{workouts?.find((w) => w.id === compound)?.name}</span>
          </span>
          <span className="link-btn">Change</span>
        </button>
      )}
      <ul className="rows" style={{ marginTop: 'var(--space-2)' }}>
        {list.map((w) => {
          const on = step === 'compound' ? compound === w.id : isolation === w.id;
          return (
            <li key={w.id}>
              <button className="row" role="radio" aria-checked={on} onClick={() => (step === 'compound' ? setCompound(w.id) : setIsolation(w.id))}>
                <span className="row-title">{w.name}</span>
                <span className={`radio ${on ? 'on' : ''}`} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

// ---------- Optional targets for one item ----------

function ItemSheet({ item, format, inGroup, onClose }: { item: ItemNode; format: LogFormat; inGroup: boolean; onClose: () => void }) {
  const live = useLiveQuery(() => db.planItems.get(item.id), [item.id]);
  const it = live ?? item;
  const set = (changes: Record<string, unknown>) => patch(db.planItems, item.id, changes);
  const iv = it.targetIntervals;
  const [showIntervals, setShowIntervals] = useState(!!iv?.rounds);
  useEffect(() => setShowIntervals((s) => s || !!iv?.rounds), [iv?.rounds]);
  const isSets = format === 'sets_weighted' || format === 'sets_bodyweight';

  function setInterval(k: 'rounds' | 'workS' | 'restS', v: number | null) {
    const next = { rounds: iv?.rounds ?? 0, workS: iv?.workS ?? 0, restS: iv?.restS ?? 0, [k]: v ?? 0 };
    set({ targetIntervals: next.rounds || next.workS || next.restS ? next : null });
  }

  return (
    <Sheet open onClose={onClose} title={item.workout?.name ?? 'Targets'}>
      <p className="muted" style={{ marginBottom: 'var(--space-4)' }}>
        Optional. Targets show as guidance while logging — you can always do more, less, or something else.
      </p>
      <div className="stack">
        {isSets && (
          <>
            <div className="grid-2">
              <label className="field-row">
                <span className="label">Sets</span>
                <AutoNumber value={it.targetSets} onSave={(v) => set({ targetSets: v })} placeholder="—" ariaLabel="Sets" />
              </label>
              <label className="field-row">
                <span className="label">Reps</span>
                <AutoText value={it.targetReps ?? ''} onSave={(v) => set({ targetReps: v || null })} placeholder="e.g. 8–10" ariaLabel="Reps" />
              </label>
            </div>
            {inGroup && (
              <div className="field-row">
                <span className="label">Role in this block</span>
                <Segmented<ItemRole>
                  ariaLabel="Role"
                  value={it.role}
                  onChange={(r) => set({ role: r })}
                  options={[
                    { value: 'warmup', label: 'Warm-up' },
                    { value: 'pre_exhaust', label: 'Pre-exhaust' },
                    { value: 'working', label: 'Working' },
                  ]}
                />
              </div>
            )}
          </>
        )}

        {(format === 'time_distance' || format === 'time_effort') && (
          <div className={format === 'time_distance' ? 'grid-2' : ''}>
            <label className="field-row">
              <span className="label">Minutes</span>
              <AutoNumber
                value={it.targetDurationS ? Math.round(it.targetDurationS / 60) : null}
                onSave={(v) => set({ targetDurationS: v ? v * 60 : null })}
                placeholder="—"
                ariaLabel="Minutes"
              />
            </label>
            {format === 'time_distance' && (
              <label className="field-row">
                <span className="label">Miles</span>
                <AutoNumber decimal value={it.targetDistanceMi} onSave={(v) => set({ targetDistanceMi: v })} placeholder="—" ariaLabel="Miles" />
              </label>
            )}
          </div>
        )}

        {format === 'time_distance' && (
          <>
            <label className="field-row">
              <span className="label">Zone / intensity</span>
              <AutoText value={it.targetZone ?? ''} onSave={(v) => set({ targetZone: v || null })} placeholder="e.g. 2, 3–4, all-out" ariaLabel="Zone" />
            </label>
            {showIntervals ? (
              <div className="field-row">
                <span className="label">Intervals</span>
                <div className="grid-3">
                  <label className="field-row">
                    <span className="hint">Rounds</span>
                    <AutoNumber value={iv?.rounds || null} onSave={(v) => setInterval('rounds', v)} placeholder="4" ariaLabel="Rounds" />
                  </label>
                  <label className="field-row">
                    <span className="hint">Work (min)</span>
                    <AutoNumber decimal value={iv?.workS ? iv.workS / 60 : null} onSave={(v) => setInterval('workS', v ? Math.round(v * 60) : null)} placeholder="4" ariaLabel="Work minutes" />
                  </label>
                  <label className="field-row">
                    <span className="hint">Rest (min)</span>
                    <AutoNumber decimal value={iv?.restS ? iv.restS / 60 : null} onSave={(v) => setInterval('restS', v ? Math.round(v * 60) : null)} placeholder="3" ariaLabel="Rest minutes" />
                  </label>
                </div>
              </div>
            ) : (
              <button className="link-btn" style={{ justifySelf: 'start' }} onClick={() => setShowIntervals(true)}>
                + Add intervals (e.g. Norwegian 4x4)
              </button>
            )}
          </>
        )}

        <label className="field-row">
          <span className="label">Note</span>
          <AutoText value={it.targetNote ?? ''} onSave={(v) => set({ targetNote: v || null })} placeholder="e.g. 2 warm-up + 1 to failure" ariaLabel="Note" />
        </label>
      </div>
    </Sheet>
  );
}
