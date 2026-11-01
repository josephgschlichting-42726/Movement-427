import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/schema';
import { Placeholder } from './Placeholder';

/** Plan gate: logging needs a plan first (plan §2). Logging itself ships in Phase 2. */
export function Log() {
  const hasPlan = useLiveQuery(async () => (await db.plans.where('status').equals('active').toArray()).some((p) => !p.deletedAt), []);
  if (hasPlan === undefined) return null;
  return hasPlan ? (
    <Placeholder title="Log" phase="Phase 2">
      <p>Your plan is set. Logging — sessions, sets, cardio, joy ratings — arrives in the next update.</p>
    </Placeholder>
  ) : (
    <Placeholder title="Log" phase="Plan first">
      <p>Logging unlocks once you've built a plan.</p>
      <Link to="/setup" className="btn btn-primary btn-block">
        Build my plan
      </Link>
    </Placeholder>
  );
}
