import { useLiveQuery } from '../db/useQuery';
import { Link } from 'react-router-dom';
import { skipLabel } from '../components/Logging';
import { StartOptions } from '../components/StartOptions';
import { ScreenHead } from '../components/ui';
import { alive, loadPlanDays } from '../db/repo';
import { db } from '../db/schema';
import { addDaysISO, friendlyDate, todayISO } from '../lib/date';
import { dayTitle } from '../lib/format';
import { Placeholder } from './Placeholder';

/** Start any session, or reopen a recent one — every session stays editable (plan §3.5). */
export function Log() {
  const plan = useLiveQuery(async () => {
    const p = (await db.plans.where('status').equals('active').toArray()).find(alive);
    return p ? { ...p, days: await loadPlanDays(p.id) } : null;
  }, []);
  const recent = useLiveQuery(async () => {
    const since = addDaysISO(todayISO(), -30);
    const ss = (await db.sessions.where('date').aboveOrEqual(since).toArray()).filter(alive);
    const entries = (await db.sessionEntries.where('sessionId').anyOf(ss.map((s) => s.id)).toArray()).filter(alive);
    const workouts = new Map((await db.workouts.toArray()).map((w) => [w.id, w]));
    const days = new Map((await db.planDays.toArray()).map((d) => [d.id, d]));
    return ss
      .sort((a, b) => (a.date === b.date ? (b.startedAt ?? b.createdAt) - (a.startedAt ?? a.createdAt) : a.date < b.date ? 1 : -1))
      .map((s) => {
        const es = entries.filter((e) => e.sessionId === s.id);
        const d = s.planDayId ? days.get(s.planDayId) : undefined;
        return {
          ...s,
          title: d ? `${dayTitle(d)}${d.label ? ` · ${d.label}` : ''}` : (workouts.get(es[0]?.workoutId ?? '')?.name ?? 'Session'),
          done: es.filter((e) => e.status === 'done').length,
          total: es.length,
        };
      });
  }, []);

  if (plan === undefined) return null;
  if (!plan)
    return (
      <Placeholder title="Log" phase="Plan first">
        <p>Logging unlocks once you've built a plan.</p>
        <Link to="/setup" className="btn btn-primary btn-block">
          Build my plan
        </Link>
      </Placeholder>
    );

  let lastDate = '';
  return (
    <div className="screen">
      <ScreenHead title="Log" />
      <p className="label group-label">Start</p>
      <StartOptions days={plan.days} />

      <p className="label group-label">Last 30 days</p>
      {recent && recent.length === 0 && <p className="muted">Nothing logged yet. Start from Today or above.</p>}
      <ul className="rows">
        {recent?.map((s) => {
          const header = s.date !== lastDate ? friendlyDate(s.date) : null;
          lastDate = s.date;
          return (
            <li key={s.id}>
              {header && <p className="label date-head">{header}</p>}
              <Link to={`/session/${s.id}`} className="row">
                <span className="row-text">
                  <span className="row-title">{s.title}</span>
                  <span className="row-sub">
                    {s.status === 'skipped'
                      ? `Skipped · ${skipLabel(s.skipReason)}`
                      : `${s.done}/${s.total} done${s.joyStart || s.joyEnd ? ` · joy ${s.joyStart ?? '–'}→${s.joyEnd ?? '–'}` : ''}`}
                  </span>
                </span>
                <span className="chev">›</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
