import { useLiveQuery } from '../../db/useQuery';
import { useNavigate } from 'react-router-dom';
import { isStandalone } from '../../components/Banners';
import { IconShare } from '../../components/Icons';
import { Wordmark } from '../../components/Wordmark';
import { alive, createPlan } from '../../db/repo';
import { db } from '../../db/schema';
import './planning.css';

/** First-run welcome: the one working-flow screen that carries the wordmark (style guide B7b). */
export function Setup() {
  const navigate = useNavigate();
  const draft = useLiveQuery(
    async () => (await db.plans.where('status').equals('draft').toArray()).filter(alive).sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null,
    [],
  );

  async function start() {
    const p = draft ?? (await createPlan());
    navigate(`/settings/planning/plan/${p.id}`);
  }

  return (
    <div className="screen setup">
      <div className="setup-mark">
        <Wordmark className="setup-wm" />
      </div>
      <div className="stack">
        <p className="label">Welcome</p>
        <h1>Plan it. Log it. See what moves you.</h1>
        <ol className="setup-steps">
          <li>
            <b>Pick a cadence</b> — day numbers (Day 1…N, repeating) or days of the week.
          </li>
          <li>
            <b>Build each day</b> — choose a type, then its workouts. Mix types on any day.
          </li>
          <li>
            <b>Use the plan</b> — logging unlocks. Skip, swap or shift days anytime.
          </li>
        </ol>
        <button className="btn btn-primary btn-block" onClick={start}>
          {draft ? 'Continue my plan' : 'Build my plan'}
        </button>
        <button className="btn btn-secondary btn-block" onClick={() => navigate('/settings/planning')}>
          Browse the workout library first
        </button>
        {!isStandalone() && (
          <p className="hint">
            Tip: install moov first — tap <IconShare /> then <b>Add to Home Screen</b>. Your data is safest in the installed app.
          </p>
        )}
      </div>
    </div>
  );
}
