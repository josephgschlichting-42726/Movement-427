import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { loadPlanDays } from '../db/repo';
import { db } from '../db/schema';
import { CADENCE_LABEL } from '../lib/format';
import { MONTHS, WEEKDAYS } from '../lib/date';
import './today.css';

export function Today() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  // undefined = still loading, null = no plan yet
  const activePlan = useLiveQuery(async () => {
    const p = (await db.plans.where('status').equals('active').toArray()).find((x) => !x.deletedAt);
    return p ? { ...p, days: await loadPlanDays(p.id) } : null;
  }, []);

  return (
    <div className="screen today">
      {/* Signature element: the date as overlapping, cropped numerals — gray sinks, orange rises. */}
      <header className="today-hero" aria-label={now.toDateString()}>
        <div className="today-num" aria-hidden>
          <span className="today-digit today-digit-a">{dd[0]}</span>
          <span className="today-digit today-digit-b">{dd[1]}</span>
        </div>
        <div className="today-tag" aria-hidden>
          <span>{WEEKDAYS[now.getDay()]}</span>
          <span>
            {MONTHS[now.getMonth()]} {now.getFullYear()}
          </span>
        </div>
      </header>

      {activePlan === undefined ? null : activePlan ? (
        <section className="stack">
          <p className="label">Your plan</p>
          <h1>{activePlan.name}</h1>
          <p className="muted">
            {CADENCE_LABEL[activePlan.cadenceMode]} · {activePlan.days.length} {activePlan.days.length === 1 ? 'day' : 'days'}
          </p>
          <div className="panel">
            <p className="label">Up next</p>
            <p className="muted" style={{ marginTop: 'var(--space-2)' }}>
              Logging — with today's suggested day — arrives in the next update.
            </p>
          </div>
          <Link to={`/settings/planning/plan/${activePlan.id}`} className="btn btn-secondary btn-block">
            View or edit plan
          </Link>
        </section>
      ) : (
        <section className="today-empty stack">
          <p className="label">Get started</p>
          <h1>Build your plan</h1>
          <p className="muted">
            mōv starts with a plan: pick a type, choose its workouts, assign it to a day — repeat until it fits your
            week. Logging unlocks once your plan exists.
          </p>
          <Link to="/setup" className="btn btn-primary btn-block">
            Start planning
          </Link>
        </section>
      )}
    </div>
  );
}
