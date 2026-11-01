import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AutoText, Empty, ScreenHead, Segmented, Sheet } from '../../components/ui';
import { useUndo } from '../../components/Undo';
import {
  activatePlan,
  addDay,
  convertCadence,
  duplicateDay,
  loadPlanDays,
  moveDay,
  patch,
  renumberDays,
  restore,
  softDelete,
} from '../../db/repo';
import { db, type CadenceMode } from '../../db/schema';
import { todayISO } from '../../lib/date';
import { dayChip, dayTitle, WEEK } from '../../lib/format';
import './planning.css';

export function PlanBuilder() {
  const { planId = '' } = useParams();
  const navigate = useNavigate();
  const undo = useUndo();
  const plan = useLiveQuery(() => db.plans.get(planId), [planId]);
  const days = useLiveQuery(() => loadPlanDays(planId), [planId]);
  const [pickWeekday, setPickWeekday] = useState(false);

  if (plan === undefined || days === undefined) return null;
  if (!plan || plan.deletedAt)
    return (
      <div className="screen">
        <ScreenHead title="Not found" back="/settings/planning" />
      </div>
    );

  const isWeek = plan.cadenceMode === 'weekdays';
  const usedWeekdays = new Set(days.map((d) => d.weekday).filter((w) => w != null));
  const hasWorkouts = days.some((d) => d.segments.some((s) => s.blocks.length));
  const active = plan.status === 'active';

  async function onAddDay() {
    if (isWeek) return setPickWeekday(true);
    const d = await addDay(plan!);
    navigate(`/settings/planning/plan/${planId}/day/${d.id}`);
  }

  async function addWeekday(n: number) {
    setPickWeekday(false);
    const d = await addDay(plan!, n);
    navigate(`/settings/planning/plan/${planId}/day/${d.id}`);
  }

  async function changeCadence(to: CadenceMode) {
    const from = plan!.cadenceMode;
    await convertCadence(planId, to);
    if (days!.length) undo(`Switched to ${to === 'weekdays' ? 'days of the week' : 'day numbers'}`, () => convertCadence(planId, from));
  }

  async function deleteDay(id: string, title: string) {
    await softDelete(db.planDays, id);
    await renumberDays(planId);
    undo(`${title} removed`, async () => {
      await restore(db.planDays, id);
      await renumberDays(planId);
    });
  }

  async function deletePlan() {
    await softDelete(db.plans, planId);
    navigate('/settings/planning');
    undo(`${plan!.name || 'Plan'} deleted`, () => restore(db.plans, planId));
  }

  // "Today is Day N" — sets the anchor so Day N falls on today (day-number plans).
  const cycle = days.length;
  const todayDay = (() => {
    if (!plan.anchorDate || !cycle) return 1;
    const diff = Math.round((Date.parse(todayISO()) - Date.parse(plan.anchorDate)) / 86400000);
    return (((diff % cycle) + cycle) % cycle) + 1;
  })();
  function setTodayIs(n: number) {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1));
    patch(db.plans, planId, { anchorDate: todayISO(d) });
  }

  return (
    <div className="screen">
      <ScreenHead
        title="Plan"
        back="/settings/planning"
        right={active ? <span className="tag tag-accent">Active</span> : <span className="tag">Draft</span>}
      />

      <div className="stack">
        <AutoText
          className="field-title"
          value={plan.name}
          onSave={(v) => patch(db.plans, planId, { name: v || 'My plan' })}
          placeholder="Plan name"
          ariaLabel="Plan name"
        />
        <div className="field-row">
          <span className="label">Cadence</span>
          <Segmented<CadenceMode>
            ariaLabel="Cadence"
            value={plan.cadenceMode}
            onChange={changeCadence}
            options={[
              { value: 'day_number', label: 'Day numbers' },
              { value: 'weekdays', label: 'Days of week' },
            ]}
          />
          <p className="hint">
            {isWeek
              ? 'Each day is tied to a weekday (Mon–Sun).'
              : 'Day 1…N, then it repeats. Skipped days shift the sequence, never lost.'}
          </p>
        </div>
      </div>

      <p className="label group-label">
        {isWeek ? 'Week' : 'Cycle'} · {days.length} {days.length === 1 ? 'day' : 'days'}
      </p>

      {days.length === 0 ? (
        <Empty big={isWeek ? 'Mon' : '01'}>
          Add your first day, then pick a type and its workouts. Repeat until the plan fits.
        </Empty>
      ) : (
        <ol className="days">
          {days.map((d, i) => {
            const workoutCount = d.segments.reduce((n, s) => n + s.blocks.reduce((m, b) => m + b.items.length, 0), 0);
            return (
              <li key={d.id} className="day-card">
                <Link to={`/settings/planning/plan/${planId}/day/${d.id}`} className="day-main">
                  <span className={`day-chip ${isWeek ? 'week' : ''}`}>{dayChip(d)}</span>
                  <span className="day-text">
                    <span className="day-title">
                      {dayTitle(d)}
                      {d.label && <span className="day-label"> · {d.label}</span>}
                      {isWeek && d.weekday == null && <span className="tag tag-accent">Pick a weekday</span>}
                    </span>
                    {d.segments.length ? (
                      d.segments.map((s) => (
                        <span key={s.id} className="day-seg">
                          <b>{s.type?.name ?? 'Type'}</b> ·{' '}
                          {s.blocks.flatMap((b) => b.items).map((it) => it.workout?.name).filter(Boolean).join(', ') || 'no workouts yet'}
                        </span>
                      ))
                    ) : (
                      <span className="day-seg muted">Empty — tap to add workouts</span>
                    )}
                  </span>
                  <span className="label num day-count">{workoutCount}</span>
                </Link>
                <div className="day-actions">
                  {!isWeek && (
                    <>
                      <button className="icon-btn" aria-label="Move up" disabled={i === 0} onClick={() => moveDay(planId, d.id, -1)}>
                        ↑
                      </button>
                      <button className="icon-btn" aria-label="Move down" disabled={i === days.length - 1} onClick={() => moveDay(planId, d.id, 1)}>
                        ↓
                      </button>
                    </>
                  )}
                  <button
                    className="link-btn"
                    disabled={isWeek && usedWeekdays.size >= 7}
                    onClick={async () => {
                      const c = await duplicateDay(plan, d.id);
                      if (c) navigate(`/settings/planning/plan/${planId}/day/${c.id}`);
                    }}
                  >
                    Duplicate
                  </button>
                  <button className="link-btn danger" onClick={() => deleteDay(d.id, dayTitle(d))}>
                    Remove
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <button className="btn btn-ghost btn-block" style={{ marginTop: 'var(--space-3)' }} onClick={onAddDay} disabled={isWeek && usedWeekdays.size >= 7}>
        + Add {isWeek ? 'a weekday' : `Day ${days.length + 1}`}
      </button>

      <div className="plan-footer stack">
        {active ? (
          !isWeek &&
          cycle > 0 && (
            <div className="field-row">
              <span className="label">Today is</span>
              <div className="chips">
                {days.map((d) => (
                  <button key={d.id} className={`chip ${todayDay === d.dayNumber ? 'on' : ''}`} onClick={() => setTodayIs(d.dayNumber ?? 1)}>
                    Day {d.dayNumber}
                  </button>
                ))}
              </div>
              <p className="hint">Sets where you are in the cycle. You can change it anytime.</p>
            </div>
          )
        ) : (
          <>
            <button className="btn btn-primary btn-block" disabled={!hasWorkouts} onClick={() => activatePlan(planId).then(() => navigate('/'))}>
              Use this plan
            </button>
            {!hasWorkouts && <p className="hint">Add at least one workout to a day to use this plan.</p>}
          </>
        )}
        <button className="link-btn danger" onClick={deletePlan}>
          Delete plan
        </button>
      </div>

      <Sheet open={pickWeekday} onClose={() => setPickWeekday(false)} title="Which day?">
        <div className="chips">
          {WEEK.map((w) => (
            <button key={w.n} className="chip" disabled={usedWeekdays.has(w.n)} onClick={() => addWeekday(w.n)}>
              {w.short}
            </button>
          ))}
        </div>
        <p className="hint" style={{ marginTop: 'var(--space-3)' }}>
          Days already in the plan are greyed out.
        </p>
      </Sheet>
    </div>
  );
}
