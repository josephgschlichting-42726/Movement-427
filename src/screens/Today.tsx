import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { MONTHS, WEEKDAYS } from '../lib/date';
import './today.css';

export function Today() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  // undefined = still loading, null = no plan yet
  const activePlan = useLiveQuery(async () => (await db.plans.where('status').equals('active').first()) ?? null, []);

  return (
    <div className="screen today">
      {/* Signature element: the date as overlapping, cropped numerals (after the "25" mural). */}
      <header className="today-hero" aria-label={now.toDateString()}>
        <span className="today-digit today-digit-a" aria-hidden>
          {dd[0]}
        </span>
        <span className="today-digit today-digit-b" aria-hidden>
          {dd[1]}
        </span>
        <div className="today-tag" aria-hidden>
          <span>{WEEKDAYS[now.getDay()]}</span>
          <span>
            {MONTHS[now.getMonth()]} {now.getFullYear()}
          </span>
        </div>
      </header>

      {activePlan === undefined ? null : activePlan ? (
        <section className="panel stack">
          <p className="label">Active plan</p>
          <h2>{activePlan.name}</h2>
        </section>
      ) : (
        <section className="today-empty stack">
          <p className="label">Get started</p>
          <h1>Build your plan</h1>
          <p className="muted">
            Movement starts with a plan: pick a type, choose its workouts, assign it to a day — repeat until it fits
            your week. Logging unlocks once your plan exists.
          </p>
          <Link to="/settings/planning" className="btn btn-primary btn-block">
            Start planning
          </Link>
        </section>
      )}
    </div>
  );
}
