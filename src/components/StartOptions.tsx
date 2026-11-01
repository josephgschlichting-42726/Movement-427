import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startSessionFromDay, startSingleWorkout } from '../db/logging';
import type { DayNode } from '../db/repo';
import { dayChip, dayTitle } from '../lib/format';
import { Sheet } from './ui';
import { TypeThenWorkout } from './WorkoutPicker';

/** "Log something else": any plan day, or any single workout from the library (off-plan). */
export function StartOptions({ days }: { days: DayNode[] }) {
  const navigate = useNavigate();
  const [pickDay, setPickDay] = useState(false);
  const [pickWorkout, setPickWorkout] = useState(false);
  return (
    <>
      <div className="grid-2">
        <button className="btn btn-secondary" disabled={!days.length} onClick={() => setPickDay(true)}>
          Another day
        </button>
        <button className="btn btn-secondary" onClick={() => setPickWorkout(true)}>
          Single workout
        </button>
      </div>

      <Sheet open={pickDay} onClose={() => setPickDay(false)} title="Which plan day?">
        <ul className="rows">
          {days.map((d) => (
            <li key={d.id}>
              <button
                className="row"
                onClick={async () => {
                  const s = await startSessionFromDay(d.id);
                  navigate(`/session/${s.id}`);
                }}
              >
                <span className="row-text">
                  <span className="row-title">
                    <span className="mini-chip">{dayChip(d)}</span> {dayTitle(d)}
                    {d.label ? ` · ${d.label}` : ''}
                  </span>
                  <span className="row-sub">{d.segments.map((s) => s.type?.name).filter(Boolean).join(' + ') || 'Empty'}</span>
                </span>
                <span className="chev">›</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {pickWorkout && (
        <TypeThenWorkout
          onCancel={() => setPickWorkout(false)}
          onPick={async (wid) => {
            const s = await startSingleWorkout(wid);
            navigate(`/session/${s.id}`);
          }}
        />
      )}
    </>
  );
}
