import { useLiveQuery } from '../db/useQuery';
import { useMemo, useState } from 'react';
import { addWorkout, alive } from '../db/repo';
import { db } from '../db/schema';
import { LOG_FORMAT_LABEL } from '../lib/format';
import { Sheet } from './ui';

/**
 * Pick workouts from one type. Search filters; typing a new name offers "+ Add".
 * multi: checkboxes + "Add N workouts". Single: tapping a workout picks it immediately.
 */
export function WorkoutPicker({
  typeId,
  multi = false,
  onDone,
  onCancel,
}: {
  typeId: string;
  multi?: boolean;
  onDone: (ids: string[]) => void;
  onCancel: () => void;
}) {
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
    setQ('');
    if (multi) setSel((s) => [...s, w.id]);
    else onDone([w.id]);
  }

  return (
    <Sheet
      open
      onClose={onCancel}
      title={type?.name ?? 'Workouts'}
      footer={
        multi ? (
          <button className="btn btn-primary btn-block" disabled={!sel.length} onClick={() => onDone(sel)}>
            {sel.length ? `Add ${sel.length} ${sel.length === 1 ? 'workout' : 'workouts'}` : 'Select workouts'}
          </button>
        ) : undefined
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
              <button
                className="row"
                role={multi ? 'checkbox' : undefined}
                aria-checked={multi ? on : undefined}
                onClick={() => (multi ? setSel((s) => (on ? s.filter((x) => x !== w.id) : [...s, w.id])) : onDone([w.id]))}
              >
                <span className="row-text">
                  <span className="row-title">{w.name}</span>
                  {w.logFormatOverride && <span className="row-sub">{LOG_FORMAT_LABEL[w.logFormatOverride]}</span>}
                </span>
                {multi ? <span className={`check ${on ? 'on' : ''}`} aria-hidden /> : <span className="chev">›</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {workouts && workouts.length === 0 && !query && <p className="muted">No workouts in this type yet — type a name above to add one.</p>}
    </Sheet>
  );
}

/** Type → workout, as one flow. */
export function TypeThenWorkout({ onPick, onCancel, title = 'What did you do?' }: { onPick: (workoutId: string) => void; onCancel: () => void; title?: string }) {
  const types = useLiveQuery(() => db.workoutTypes.orderBy('order').filter((t) => alive(t) && !t.archived).toArray(), []);
  const [typeId, setTypeId] = useState<string | null>(null);
  if (typeId) return <WorkoutPicker typeId={typeId} onDone={(ids) => ids[0] && onPick(ids[0])} onCancel={() => setTypeId(null)} />;
  return (
    <Sheet open onClose={onCancel} title={title}>
      <ul className="rows">
        {types?.map((t) => (
          <li key={t.id}>
            <button className="row" onClick={() => setTypeId(t.id)}>
              <span className="row-text">
                <span className="row-title">{t.name}</span>
                <span className="row-sub">{LOG_FORMAT_LABEL[t.defaultLogFormat]}</span>
              </span>
              <span className="chev">›</span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
