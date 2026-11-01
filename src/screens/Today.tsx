import { useLiveQuery } from '../db/useQuery';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckInRows, SkipSheet, skipLabel } from '../components/Logging';
import { StartOptions } from '../components/StartOptions';
import { useUndo } from '../components/Undo';
import { computeNextUp, deleteSession, sessionsOn, setCheckin, skipDay, startSessionFromDay, type NextUp } from '../db/logging';
import { alive, type DayNode } from '../db/repo';
import { db, type Session } from '../db/schema';
import { MONTHS, todayISO, WEEKDAYS } from '../lib/date';
import { dayChip, dayTitle } from '../lib/format';
import './today.css';

export function Today() {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const today = todayISO();
  // undefined = still loading, null = no plan yet
  const next = useLiveQuery(() => computeNextUp(), []);
  const checkin = useLiveQuery(async () => (await db.dailyCheckins.where('date').equals(today).first()) ?? null, [today]);
  const todays = useLiveQuery(async () => {
    const ss = await sessionsOn(today);
    const entries = (await db.sessionEntries.where('sessionId').anyOf(ss.map((s) => s.id)).toArray()).filter(alive);
    const workouts = new Map((await db.workouts.toArray()).map((w) => [w.id, w]));
    const days = new Map((await db.planDays.toArray()).map((d) => [d.id, d]));
    return ss.map((s) => {
      const es = entries.filter((e) => e.sessionId === s.id);
      const d = s.planDayId ? days.get(s.planDayId) : undefined;
      const title = d ? `${dayTitle(d)}${d.label ? ` · ${d.label}` : ''}` : (workouts.get(es[0]?.workoutId ?? '')?.name ?? 'Session');
      return { ...s, title, done: es.filter((e) => e.status === 'done').length, total: es.length };
    });
  }, [today]);

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

      {next === undefined ? null : next ? (
        <>
          <NextUpSection next={next} todays={todays ?? []} />

          <section className="today-section">
            <p className="label section-label">Today’s check-in</p>
            <CheckInRows
              sleep={checkin?.sleep}
              mood={checkin?.mood}
              motivation={checkin?.motivation}
              onChange={(f, v) => setCheckin(today, { [f]: v })}
            />
          </section>

          {todays && todays.length > 0 && (
            <section className="today-section">
              <p className="label section-label">Logged today</p>
              <ul className="rows">
                {todays.map((s) => (
                  <li key={s.id}>
                    <Link to={`/session/${s.id}`} className="row">
                      <span className="row-text">
                        <span className="row-title">{s.title}</span>
                        <span className="row-sub">
                          {s.status === 'skipped'
                            ? `Skipped · ${skipLabel(s.skipReason)}`
                            : `${s.status === 'done' ? 'Finished' : 'In progress'} · ${s.done}/${s.total} done${
                                s.joyStart || s.joyEnd ? ` · joy ${s.joyStart ?? '–'}→${s.joyEnd ?? '–'}` : ''
                              }`}
                        </span>
                      </span>
                      <span className="chev">›</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="today-section">
            <p className="label section-label">Log something else</p>
            <StartOptions days={next.days} />
          </section>
        </>
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

/** Next up: weekday plans show today's entry; day-number plans offer "next in sequence" vs "on schedule" (plan §3.3). */
function NextUpSection({ next, todays }: { next: NextUp; todays: (Session & { title: string })[] }) {
  const inProgress = todays.find((s) => s.status === 'in_progress');
  const candidates: { day: DayNode; why: string }[] = [];
  if (next.plan.cadenceMode === 'weekdays') {
    if (next.today) candidates.push({ day: next.today, why: 'Today' });
  } else if (next.inSequence && next.onSchedule && next.inSequence.id !== next.onSchedule.id) {
    candidates.push({ day: next.inSequence, why: 'Next in sequence' }, { day: next.onSchedule, why: 'On schedule' });
  } else if (next.inSequence) {
    candidates.push({ day: next.inSequence, why: 'Up next' });
  }
  const loggedToday = new Set(next.doneToday.map((s) => s.planDayId));

  return (
    <section className="today-section">
      <div className="section-head">
        <p className="label">{next.plan.name}</p>
        <Link to={`/settings/planning/plan/${next.plan.id}`} className="link-btn">
          Edit plan
        </Link>
      </div>
      {inProgress && (
        <Link to={`/session/${inProgress.id}`} className="resume">
          <span className="label">In progress</span>
          <span className="resume-title">{inProgress.title}</span>
          <span className="resume-go">Resume ›</span>
        </Link>
      )}
      {candidates.length === 0 && (
        <p className="muted" style={{ padding: 'var(--space-3) 0' }}>
          Nothing planned today. Rest, or log something below.
        </p>
      )}
      {candidates.length > 1 && (
        <p className="hint" style={{ marginBottom: 'var(--space-2)' }}>
          You’re off the calendar — pick the one you want.
        </p>
      )}
      <div className="next-cards">
        {candidates.map((c) => (
          <NextCard key={c.why + c.day.id} day={c.day} why={c.why} logged={loggedToday.has(c.day.id)} />
        ))}
      </div>
    </section>
  );
}

function NextCard({ day, why, logged }: { day: DayNode; why: string; logged: boolean }) {
  const navigate = useNavigate();
  const undo = useUndo();
  const [skipping, setSkipping] = useState(false);
  const workouts = day.segments.flatMap((s) => s.blocks.flatMap((b) => b.items.map((i) => i.workout?.name))).filter(Boolean);
  return (
    <article className="next-card">
      <div className="next-top">
        <span className="next-chip">{dayChip(day)}</span>
        <div className="next-text">
          <span className="label">{why}{logged ? ' · logged today' : ''}</span>
          <h2>
            {dayTitle(day)}
            {day.label ? ` · ${day.label}` : ''}
          </h2>
          <p className="next-list">
            {day.segments.map((s) => (
              <span key={s.id}>
                <b>{s.type?.name}</b> {s.blocks.flatMap((b) => b.items.map((i) => i.workout?.name)).filter(Boolean).join(', ')}
              </span>
            ))}
            {!workouts.length && 'No workouts in this day yet.'}
          </p>
        </div>
      </div>
      <div className="next-actions">
        <button
          className="btn btn-primary"
          onClick={async () => {
            const s = await startSessionFromDay(day.id);
            navigate(`/session/${s.id}`);
          }}
        >
          Start
        </button>
        <button className="btn btn-secondary" onClick={() => setSkipping(true)}>
          Skip day
        </button>
      </div>
      {skipping && (
        <SkipSheet
          title={`Skip ${dayTitle(day)}`}
          onClose={() => setSkipping(false)}
          onSkip={async (reason, note) => {
            setSkipping(false);
            const s = await skipDay(day.id, reason, note);
            undo(`${dayTitle(day)} skipped`, () => deleteSession(s.id).then(() => undefined));
          }}
        />
      )}
    </article>
  );
}
