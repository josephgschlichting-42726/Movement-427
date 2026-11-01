import { useLiveQuery } from '../../db/useQuery';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Empty, RowLink, ScreenHead, Sheet } from '../../components/ui';
import { addType, alive, createPlan } from '../../db/repo';
import { db, type LogFormat } from '../../db/schema';
import { CADENCE_LABEL, LOG_FORMATS, LOG_FORMAT_LABEL } from '../../lib/format';

export function PlanningHome() {
  const navigate = useNavigate();
  const types = useLiveQuery(() => db.workoutTypes.orderBy('order').filter((t) => alive(t) && !t.archived).toArray(), []);
  const counts = useLiveQuery(async () => {
    const ws = (await db.workouts.toArray()).filter((w) => alive(w) && !w.archived);
    const m: Record<string, number> = {};
    for (const w of ws) m[w.typeId] = (m[w.typeId] ?? 0) + 1;
    return m;
  }, []);
  const plans = useLiveQuery(async () => {
    const ps = (await db.plans.toArray()).filter((p) => alive(p) && p.status !== 'archived');
    const days = (await db.planDays.toArray()).filter(alive);
    return ps
      .map((p) => ({ ...p, dayCount: days.filter((d) => d.planId === p.id).length }))
      .sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : b.updatedAt - a.updatedAt));
  }, []);
  const [addingType, setAddingType] = useState(false);

  async function newPlan() {
    const p = await createPlan();
    navigate(`/settings/planning/plan/${p.id}`);
  }

  return (
    <div className="screen">
      <ScreenHead title="Planning" back="/settings" />

      <p className="label group-label">Plans</p>
      {plans && plans.length === 0 ? (
        <Empty big="00">No plan yet. Build one from your workout library below.</Empty>
      ) : (
        <ul className="rows">
          {plans?.map((p) => (
            <li key={p.id}>
              <RowLink
                to={`/settings/planning/plan/${p.id}`}
                title={p.name || 'Untitled plan'}
                sub={`${CADENCE_LABEL[p.cadenceMode]} · ${p.dayCount} ${p.dayCount === 1 ? 'day' : 'days'}`}
                right={p.status === 'active' ? <span className="tag tag-accent">Active</span> : <span className="tag">Draft</span>}
              />
            </li>
          ))}
        </ul>
      )}
      <button className="btn btn-ghost btn-block" style={{ marginTop: 'var(--space-3)' }} onClick={newPlan}>
        + New plan
      </button>

      <p className="label group-label">Workout library</p>
      <ul className="rows">
        {types?.map((t) => (
          <li key={t.id}>
            <RowLink
              to={`/settings/planning/type/${t.id}`}
              title={t.name}
              sub={LOG_FORMAT_LABEL[t.defaultLogFormat]}
              right={<span className="label num">{counts?.[t.id] ?? 0}</span>}
            />
          </li>
        ))}
      </ul>
      <button className="btn btn-ghost btn-block" style={{ marginTop: 'var(--space-3)' }} onClick={() => setAddingType(true)}>
        + Add a type
      </button>

      <AddTypeSheet
        open={addingType}
        onClose={() => setAddingType(false)}
        onCreated={(id) => navigate(`/settings/planning/type/${id}`)}
      />
    </div>
  );
}

function AddTypeSheet({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [format, setFormat] = useState<LogFormat>('time_effort');
  async function save() {
    if (!name.trim()) return;
    const t = await addType(name.trim(), format);
    setName('');
    onClose();
    onCreated(t.id);
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="New type"
      footer={
        <button className="btn btn-primary btn-block" disabled={!name.trim()} onClick={save}>
          Add type
        </button>
      }
    >
      <div className="stack">
        <label className="field-row">
          <span className="label">Name</span>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sport, Hiking, Climbing" autoFocus />
        </label>
        <div className="field-row">
          <span className="label">How it's logged</span>
          <FormatPicker value={format} onChange={(f) => f && setFormat(f)} />
        </div>
      </div>
    </Sheet>
  );
}

export function FormatPicker({ value, onChange, allowDefault, defaultLabel }: { value: LogFormat | null; onChange: (v: LogFormat | null) => void; allowDefault?: boolean; defaultLabel?: string }) {
  const opts: (LogFormat | null)[] = allowDefault ? [null, ...LOG_FORMATS] : LOG_FORMATS;
  return (
    <ul className="rows" role="radiogroup">
      {opts.map((f) => (
        <li key={f ?? 'default'}>
          <button className="row" role="radio" aria-checked={value === f} onClick={() => onChange(f)}>
            <span className="row-text">
              <span className="row-title">{f ? LOG_FORMAT_LABEL[f] : `Same as type (${defaultLabel})`}</span>
            </span>
            <span className={`radio ${value === f ? 'on' : ''}`} aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}
