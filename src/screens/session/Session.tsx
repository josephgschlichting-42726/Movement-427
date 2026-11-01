import { useLiveQuery } from '../../db/useQuery';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Numerals, RatingKeys, SkipSheet, skipLabel } from '../../components/Logging';
import { AutoText, ScreenHead, Sheet } from '../../components/ui';
import { useUndo } from '../../components/Undo';
import { TypeThenWorkout } from '../../components/WorkoutPicker';
import {
  addEntryToSession,
  deleteSession,
  lastTime,
  loadSession,
  setSessionDate,
  startSessionFromDay,
  type EntryNode,
  type LastTime,
  type SessionNode,
} from '../../db/logging';
import { alive, loadPlanDays, patch, restore, softDelete } from '../../db/repo';
import { db, type Rating } from '../../db/schema';
import { friendlyDate } from '../../lib/date';
import { BLOCK_LABEL, dayTitle, ROLE_LABEL, targetSummary } from '../../lib/format';
import { EffortLogger, SetLogger, TimedLogger, setsSummary, timedSummary, effortSummary } from './Loggers';
import './session.css';

export function SessionScreen() {
  const { sessionId = '' } = useParams();
  const navigate = useNavigate();
  const undo = useUndo();
  const s = useLiveQuery(() => loadSession(sessionId), [sessionId]);
  const [adding, setAdding] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [details, setDetails] = useState(false);

  if (s === undefined) return null;
  if (!s)
    return (
      <div className="screen">
        <ScreenHead title="Not found" back="/" />
      </div>
    );

  const title = s.day ? `${dayTitle(s.day)}${s.day.label ? ` · ${s.day.label}` : ''}` : (s.blocks[0]?.entries[0]?.workout?.name ?? 'Session');
  const entries = s.blocks.flatMap((b) => b.entries);
  const doneCount = entries.filter((e) => e.status === 'done').length;

  // ----- A deliberately skipped day -----
  if (s.status === 'skipped') {
    return (
      <div className="screen">
        <ScreenHead title={title} label={friendlyDate(s.date)} back="/" />
        <div className="stack">
          <p className="label">Skipped · {skipLabel(s.skipReason)}</p>
          {s.skipNote && <p className="muted">{s.skipNote}</p>}
          <button
            className="btn btn-primary btn-block"
            onClick={async () => {
              await softDelete(db.sessions, s.id);
              const n = await startSessionFromDay(s.planDayId!, s.date);
              navigate(`/session/${n.id}`, { replace: true });
            }}
          >
            Log it instead
          </button>
          <button
            className="btn btn-secondary btn-block"
            onClick={async () => {
              await softDelete(db.sessions, s.id);
              navigate('/');
              undo('Skip undone', () => restore(db.sessions, s.id));
            }}
          >
            Undo skip
          </button>
        </div>
      </div>
    );
  }

  async function finish(joyEnd: Rating | null) {
    const prev = { status: s!.status, endedAt: s!.endedAt ?? null, joyEnd: s!.joyEnd ?? null };
    await patch(db.sessions, s!.id, { status: 'done', endedAt: Date.now(), joyEnd });
    setFinishing(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    undo('Session finished', () => patch(db.sessions, s!.id, prev));
  }

  return (
    <div className="screen session">
      <ScreenHead
        title={title}
        label={`${friendlyDate(s.date)} · ${doneCount}/${entries.length} done`}
        back="/"
        right={
          <button className="link-btn" onClick={() => setDetails(true)}>
            Details
          </button>
        }
      />

      {s.status === 'done' && <JoySummary s={s} onReopen={() => patch(db.sessions, s.id, { status: 'in_progress' })} />}

      {s.status !== 'done' && (
        <section className={`joy-card ${s.joyStart ? 'set' : ''}`}>
          <p className="label">Joy to move · starting</p>
          {!s.joyStart && <p className="joy-q">How much do you feel like moving right now?</p>}
          <RatingKeys
            size={s.joyStart ? 'md' : 'lg'}
            label="Joy to move at start"
            value={s.joyStart}
            onChange={(v) => patch(db.sessions, s.id, { joyStart: v })}
            lowHint="Dragging"
            highHint="Can't wait"
          />
        </section>
      )}

      <ol className="entries">
        {s.blocks.map((b) => {
          const grouped = b.blockType !== 'straight';
          return (
            <li key={b.id} className={`entry-block ${grouped ? `grouped ${b.blockType}` : ''}`}>
              {grouped && <span className={`tag ${b.blockType === 'superset' ? 'tag-teal' : 'tag-accent'}`}>{BLOCK_LABEL[b.blockType]}</span>}
              {b.entries.map((e) => (
                <EntryCard key={e.id} entry={e} sessionId={s.id} grouped={grouped} />
              ))}
            </li>
          );
        })}
      </ol>

      <button className="btn btn-ghost btn-block" style={{ marginTop: 'var(--space-4)' }} onClick={() => setAdding(true)}>
        + Add a workout
      </button>

      {s.status !== 'done' && (
        <button className="btn btn-primary btn-block" style={{ marginTop: 'var(--space-5)' }} onClick={() => setFinishing(true)}>
          Finish session
        </button>
      )}

      {adding && (
        <TypeThenWorkout
          title="Add a workout"
          onCancel={() => setAdding(false)}
          onPick={async (wid) => {
            setAdding(false);
            await addEntryToSession(s.id, wid);
          }}
        />
      )}

      {finishing && <FinishSheet s={s} onFinish={finish} onClose={() => setFinishing(false)} />}
      {details && <DetailsSheet s={s} onClose={() => setDetails(false)} />}
    </div>
  );
}

// ---------- Joy summary (signature numerals) ----------

function JoySummary({ s, onReopen }: { s: SessionNode; onReopen: () => void }) {
  const a = s.joyStart ?? '–';
  const b = s.joyEnd ?? '–';
  const delta = s.joyStart && s.joyEnd ? s.joyEnd - s.joyStart : null;
  return (
    <section className="joy-summary">
      <div className="joy-summary-head">
        <p className="label">Joy to move · start → end</p>
        <button className="link-btn" onClick={onReopen}>
          Reopen
        </button>
      </div>
      <Numerals a={a} b={b} className="joy-numerals" />
      <p className="muted">
        {delta == null
          ? 'Add your start and end joy to see the change.'
          : delta > 0
            ? `Up ${delta}. Moving lifted you.`
            : delta < 0
              ? `Down ${-delta}. Noted — tomorrow's another day.`
              : 'Held steady.'}
      </p>
    </section>
  );
}

function FinishSheet({ s, onFinish, onClose }: { s: SessionNode; onFinish: (j: Rating | null) => void; onClose: () => void }) {
  const [joy, setJoy] = useState<Rating | null>(s.joyEnd ?? null);
  const pending = s.blocks.flatMap((b) => b.entries).filter((e) => e.status === 'pending').length;
  return (
    <Sheet
      open
      onClose={onClose}
      title="Finish"
      footer={
        <button className="btn btn-primary btn-block" onClick={() => onFinish(joy)}>
          Finish session
        </button>
      }
    >
      <p className="label">Joy to move · ending</p>
      <p className="joy-q">How much joy to move are you finishing with?</p>
      <RatingKeys size="lg" label="Joy to move at end" value={joy} onChange={setJoy} lowHint="Spent" highHint="Buzzing" />
      {pending > 0 && (
        <p className="hint" style={{ marginTop: 'var(--space-4)' }}>
          {pending} {pending === 1 ? 'workout isn’t' : 'workouts aren’t'} marked done. That’s fine — you can come back and finish or skip them anytime.
        </p>
      )}
    </Sheet>
  );
}

// ---------- Session details: date, plan day, note, delete ----------

function DetailsSheet({ s, onClose }: { s: SessionNode; onClose: () => void }) {
  const navigate = useNavigate();
  const undo = useUndo();
  const days = useLiveQuery(async () => {
    const plan = (await db.plans.where('status').equals('active').toArray()).find(alive);
    return plan ? loadPlanDays(plan.id) : [];
  }, []);
  return (
    <Sheet open onClose={onClose} title="Session details">
      <div className="stack">
        <label className="field-row">
          <span className="label">Date</span>
          <input className="field" type="date" value={s.date} onChange={(e) => e.target.value && setSessionDate(s.id, e.target.value)} />
        </label>
        {days && days.length > 0 && (
          <label className="field-row">
            <span className="label">Counts as</span>
            <select className="field" value={s.planDayId ?? ''} onChange={(e) => patch(db.sessions, s.id, { planDayId: e.target.value || null })}>
              <option value="">Not a plan day</option>
              {days.map((d) => (
                <option key={d.id} value={d.id}>
                  {dayTitle(d)}
                  {d.label ? ` · ${d.label}` : ''}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field-row">
          <span className="label">Note</span>
          <AutoText value={s.note ?? ''} onSave={(v) => patch(db.sessions, s.id, { note: v })} placeholder="How did it go?" />
        </label>
        <button
          className="link-btn danger"
          style={{ justifySelf: 'start' }}
          onClick={async () => {
            const back = await deleteSession(s.id);
            onClose();
            navigate('/');
            undo('Session deleted', back);
          }}
        >
          Delete session
        </button>
      </div>
    </Sheet>
  );
}

// ---------- One workout in the session ----------

function EntryCard({ entry: e, sessionId, grouped }: { entry: EntryNode; sessionId: string; grouped: boolean }) {
  const undo = useUndo();
  const [open, setOpen] = useState(e.status === 'pending');
  const [skipping, setSkipping] = useState(false);
  const [last, setLast] = useState<LastTime | null | undefined>(undefined);
  useEffect(() => {
    lastTime(e.workoutId, sessionId).then(setLast);
  }, [e.workoutId, sessionId]);

  const target = e.planItem ? targetSummary(e.planItem) : '';
  const isSets = e.format === 'sets_weighted' || e.format === 'sets_bodyweight';
  const summary = isSets ? setsSummary(e.sets, e.format) : e.format === 'time_distance' ? timedSummary(e.timed) : effortSummary(e.effort);
  const lastSummary = last
    ? isSets
      ? setsSummary(last.sets, e.format)
      : e.format === 'time_distance'
        ? timedSummary(last.timed)
        : effortSummary(last.effort)
    : '';

  async function setStatus(status: 'pending' | 'done' | 'skipped', extra: Record<string, unknown> = {}) {
    const prev = { status: e.status, skipReason: e.skipReason ?? null, skipNote: e.skipNote ?? null };
    await patch(db.sessionEntries, e.id, { status, ...extra });
    if (status !== 'pending') {
      setOpen(false);
      undo(`${e.workout?.name ?? 'Workout'} ${status === 'done' ? 'done' : 'skipped'}`, async () => {
        await patch(db.sessionEntries, e.id, prev);
        setOpen(true);
      });
      // Bring the next pending workout into view.
      setTimeout(() => {
        const all = Array.from(document.querySelectorAll<HTMLElement>('.entry'));
        const idx = all.findIndex((el) => el.dataset.entry === e.id);
        all.slice(idx + 1).find((el) => el.dataset.status === 'pending')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 120);
    } else setOpen(true);
  }

  return (
    <article className={`entry ${e.status}`} data-entry={e.id} data-status={e.status}>
      <button className="entry-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="entry-title">
          <span className="entry-name">{e.workout?.name ?? 'Workout'}</span>
          {grouped && <span className="item-role"> · {ROLE_LABEL[e.role]}</span>}
        </span>
        <span className={`entry-status ${e.status}`}>
          {e.status === 'done' ? '✓ Done' : e.status === 'skipped' ? `Skipped${e.skipReason ? ` · ${skipLabel(e.skipReason)}` : ''}` : ''}
        </span>
        {!open && summary && <span className="entry-summary">{summary}</span>}
      </button>

      {open && (
        <div className="entry-body">
          {(target || lastSummary) && (
            <dl className="guide">
              {target && (
                <>
                  <dt>Plan</dt>
                  <dd>{target}</dd>
                </>
              )}
              {lastSummary && (
                <>
                  <dt>Last · {friendlyDate(last!.date)}</dt>
                  <dd>{lastSummary}</dd>
                </>
              )}
            </dl>
          )}

          {e.status !== 'skipped' &&
            (isSets ? (
              <SetLogger entry={e} last={last ?? null} />
            ) : e.format === 'time_distance' ? (
              <TimedLogger entry={e} last={last ?? null} />
            ) : (
              <EffortLogger entry={e} last={last ?? null} />
            ))}

          <div className="entry-foot">
            {e.status === 'pending' && (
              <>
                <button className="btn btn-primary" onClick={() => setStatus('done')}>
                  Done
                </button>
                <button className="link-btn" onClick={() => setSkipping(true)}>
                  Skip
                </button>
              </>
            )}
            {e.status === 'done' && (
              <button className="btn btn-secondary btn-sm" onClick={() => setStatus('pending')}>
                Reopen
              </button>
            )}
            {e.status === 'skipped' && (
              <button className="btn btn-secondary btn-sm" onClick={() => setStatus('pending', { skipReason: null, skipNote: null })}>
                Un-skip
              </button>
            )}
            <button
              className="link-btn danger"
              style={{ marginLeft: 'auto' }}
              onClick={async () => {
                await softDelete(db.sessionEntries, e.id);
                undo(`${e.workout?.name ?? 'Workout'} removed`, () => restore(db.sessionEntries, e.id));
              }}
            >
              Remove
            </button>
          </div>
        </div>
      )}

      {skipping && (
        <SkipSheet
          title={`Skip ${e.workout?.name ?? 'workout'}`}
          onClose={() => setSkipping(false)}
          onSkip={(reason, note) => {
            setSkipping(false);
            setStatus('skipped', { skipReason: reason, skipNote: note || null });
          }}
        />
      )}
    </article>
  );
}
