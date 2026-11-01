import { useLiveQuery } from '../../db/useQuery';
import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AutoText, Empty, ScreenHead, Sheet } from '../../components/ui';
import { useUndo } from '../../components/Undo';
import { addWorkout, alive, patch } from '../../db/repo';
import { db, type Workout } from '../../db/schema';
import { LOG_FORMAT_LABEL } from '../../lib/format';
import { FormatPicker } from './PlanningHome';

export function TypeDetail() {
  const { typeId = '' } = useParams();
  const navigate = useNavigate();
  const undo = useUndo();
  const type = useLiveQuery(() => db.workoutTypes.get(typeId), [typeId]);
  const workouts = useLiveQuery(
    async () =>
      (await db.workouts.where('typeId').equals(typeId).toArray())
        .filter((w) => alive(w) && !w.archived)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [typeId],
  );
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<Workout | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (type === undefined) return null;
  if (!type || type.deletedAt) return <div className="screen"><ScreenHead title="Not found" back="/settings/planning" /></div>;

  async function add() {
    const n = name.trim();
    if (!n) return;
    await addWorkout(typeId, n);
    setName('');
    inputRef.current?.focus(); // stay ready for the next one
  }

  async function archiveType() {
    await patch(db.workoutTypes, typeId, { archived: true });
    navigate('/settings/planning');
    undo(`${type!.name} archived`, () => patch(db.workoutTypes, typeId, { archived: false }));
  }

  return (
    <div className="screen">
      <ScreenHead title={type.name} label="Workout type" back="/settings/planning" />

      <div className="stack">
        <label className="field-row">
          <span className="label">Name</span>
          <AutoText value={type.name} onSave={(v) => v && patch(db.workoutTypes, typeId, { name: v })} ariaLabel="Type name" />
        </label>
        <button className="row" onClick={() => setFormatOpen(true)} style={{ borderBottom: '1px solid var(--divider)' }}>
          <span className="row-text">
            <span className="label">Logged as</span>
            <span className="row-title">{LOG_FORMAT_LABEL[type.defaultLogFormat]}</span>
          </span>
          <span className="chev" aria-hidden>
            ›
          </span>
        </button>
      </div>

      <p className="label group-label">Workouts · {workouts?.length ?? 0}</p>
      <form
        className="add-inline"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          ref={inputRef}
          className="field"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={`Add a ${type.name.toLowerCase()} workout`}
          aria-label="New workout name"
          enterKeyHint="done"
        />
        <button className="btn btn-primary btn-sm" type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>

      {workouts && workouts.length === 0 ? (
        <Empty big="00">No workouts yet. Add the variations you actually do.</Empty>
      ) : (
        <ul className="rows" style={{ marginTop: 'var(--space-3)' }}>
          {workouts?.map((w) => (
            <li key={w.id}>
              <button className="row" onClick={() => setEditing(w)}>
                <span className="row-text">
                  <span className="row-title">{w.name}</span>
                  {w.logFormatOverride && <span className="row-sub">{LOG_FORMAT_LABEL[w.logFormatOverride]}</span>}
                </span>
                <span className="chev" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ marginTop: 'var(--space-7)' }}>
        <button className="link-btn danger" onClick={archiveType}>
          Archive this type
        </button>
      </div>

      <Sheet open={formatOpen} onClose={() => setFormatOpen(false)} title="Logged as">
        <p className="muted" style={{ marginBottom: 'var(--space-3)' }}>
          The fields you'll fill in when logging. Individual workouts can override this.
        </p>
        <FormatPicker
          value={type.defaultLogFormat}
          onChange={(f) => f && patch(db.workoutTypes, typeId, { defaultLogFormat: f })}
        />
      </Sheet>

      <WorkoutSheet
        workout={editing}
        typeFormatLabel={LOG_FORMAT_LABEL[type.defaultLogFormat]}
        onClose={() => setEditing(null)}
        onArchive={(w) => {
          setEditing(null);
          patch(db.workouts, w.id, { archived: true });
          undo(`${w.name} archived`, () => patch(db.workouts, w.id, { archived: false }));
        }}
      />
    </div>
  );
}

function WorkoutSheet({
  workout,
  typeFormatLabel,
  onClose,
  onArchive,
}: {
  workout: Workout | null;
  typeFormatLabel: string;
  onClose: () => void;
  onArchive: (w: Workout) => void;
}) {
  // Read live so edits made in the sheet show immediately.
  const w = useLiveQuery(() => (workout ? db.workouts.get(workout.id) : undefined), [workout?.id]);
  if (!workout) return null;
  const cur = w ?? workout;
  return (
    <Sheet open={!!workout} onClose={onClose} title="Workout">
      <div className="stack">
        <label className="field-row">
          <span className="label">Name</span>
          <AutoText value={cur.name} onSave={(v) => v && patch(db.workouts, cur.id, { name: v })} ariaLabel="Workout name" />
        </label>
        <label className="field-row">
          <span className="label">Notes</span>
          <AutoText value={cur.notes ?? ''} onSave={(v) => patch(db.workouts, cur.id, { notes: v })} placeholder="Cues, setup, equipment…" />
        </label>
        <div className="field-row">
          <span className="label">Logged as</span>
          <FormatPicker
            allowDefault
            defaultLabel={typeFormatLabel}
            value={cur.logFormatOverride ?? null}
            onChange={(f) => patch(db.workouts, cur.id, { logFormatOverride: f })}
          />
        </div>
        <button className="link-btn danger" onClick={() => onArchive(cur)}>
          Archive workout
        </button>
      </div>
    </Sheet>
  );
}
