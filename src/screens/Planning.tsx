import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db, type LogFormat } from '../db/schema';
import './settings.css';

const FORMAT_LABEL: Record<LogFormat, string> = {
  sets_weighted: 'Sets · weight · reps',
  sets_bodyweight: 'Sets · reps',
  time_distance: 'Time · distance · intervals',
  time_effort: 'Time · effort',
};

/** Phase 0: shows the seeded workout types. Phase 1 builds the library and plan builder here. */
export function Planning() {
  const types = useLiveQuery(() => db.workoutTypes.orderBy('order').filter((t) => !t.deletedAt).toArray(), []);

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>Planning</h1>
        <Link to="/settings" className="label">
          Back
        </Link>
      </div>

      <p className="label settings-group">Workout types</p>
      <ul className="rows">
        {types?.map((t) => (
          <li key={t.id} className="row">
            <span>
              <span className="row-title">{t.name}</span>
              <span className="row-sub">{FORMAT_LABEL[t.defaultLogFormat]}</span>
            </span>
            <span className="label">0 workouts</span>
          </li>
        ))}
      </ul>

      <div className="panel stack" style={{ marginTop: 'var(--space-6)' }}>
        <p className="label">Coming in Phase 1</p>
        <p className="muted">
          Add workouts to each type, add your own types, and build your plan: pick a type → choose workouts → assign a
          day → repeat until done.
        </p>
      </div>
    </div>
  );
}
