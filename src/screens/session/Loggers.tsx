import { useState } from 'react';
import { RatingKeys, Stepper } from '../../components/Logging';
import { AutoText } from '../../components/ui';
import { useUndo } from '../../components/Undo';
import { addSet, upsertEffort, upsertTimed, type EntryNode, type LastTime } from '../../db/logging';
import { patch, restore, softDelete } from '../../db/repo';
import { db, type EffortDetail, type LogFormat, type SetKind, type TimedDetail, type WorkSet } from '../../db/schema';
import { fmtSec } from '../../lib/format';

const KIND_LABEL: Record<SetKind, string> = { warmup: 'Warm-up', working: 'Working', drop: 'Drop', negative: 'Negatives' };

// ---------- Summaries ----------

export function setsSummary(sets: WorkSet[], format: LogFormat): string {
  const logged = sets.filter((s) => s.reps != null || s.weightLb != null);
  if (!logged.length) return '';
  return logged
    .map((s) => {
      const core = format === 'sets_weighted' && s.weightLb != null ? `${s.weightLb}×${s.reps ?? '–'}` : `${s.reps ?? '–'}`;
      return s.kind === 'working' ? core : `${core} ${s.kind === 'warmup' ? 'w' : s.kind === 'drop' ? 'drop' : 'neg'}`;
    })
    .join(', ');
}

export function timedSummary(t?: TimedDetail): string {
  if (!t) return '';
  const parts: string[] = [];
  if (t.intervals?.rounds) parts.push(`${t.intervals.rounds}× ${fmtSec(t.intervals.workS)}/${fmtSec(t.intervals.restS)}`);
  if (t.durationS) parts.push(`${Math.round(t.durationS / 60)} min`);
  if (t.distanceMi) parts.push(`${t.distanceMi} mi`);
  if (t.zone) parts.push(`zone ${t.zone}`);
  return parts.join(' · ');
}

export function effortSummary(e?: EffortDetail): string {
  if (!e) return '';
  const parts: string[] = [];
  if (e.durationS) parts.push(`${Math.round(e.durationS / 60)} min`);
  if (e.effort) parts.push(`effort ${e.effort}/5`);
  return parts.join(' · ');
}

// ---------- Sets: decide as you go (plan §4) ----------

/** Ghost value for a new/blank set: last time's set of the same kind and position, else the previous set here. */
function ghostFor(set: WorkSet, sets: WorkSet[], last: LastTime | null): Partial<WorkSet> {
  const sameKindIdx = sets.filter((s) => s.kind === set.kind && s.order < set.order).length;
  const lastSame = last?.sets.filter((s) => s.kind === set.kind)[sameKindIdx];
  if (lastSame) return lastSame;
  const prev = [...sets].filter((s) => s.order < set.order).at(-1);
  return prev ?? {};
}

export function SetLogger({ entry, last }: { entry: EntryNode; last: LastTime | null }) {
  const undo = useUndo();
  const weighted = entry.format === 'sets_weighted';

  async function add(kind: SetKind) {
    const prev = entry.sets.at(-1);
    // Drop sets start a bit lighter than the set they follow; everything else starts blank with ghost values.
    const prefill = kind === 'drop' && prev?.weightLb ? { weightLb: Math.max(0, Math.round(prev.weightLb * 0.8 / 5) * 5) } : {};
    await addSet(entry.id, kind, prefill);
  }

  return (
    <div className="sets">
      {entry.sets.map((s, i) => {
        const ghost = ghostFor(s, entry.sets, last);
        const blank = s.reps == null && s.weightLb == null;
        const hasGhost = ghost.reps != null || ghost.weightLb != null;
        return (
          <div key={s.id} className={`set ${s.kind}`}>
            <div className="set-head">
              <span className="set-n num">{String(i + 1).padStart(2, '0')}</span>
              <span className={`set-kind ${s.kind}`}>{KIND_LABEL[s.kind]}</span>
              {blank && hasGhost && (
                <button className="link-btn" onClick={() => patch(db.sets, s.id, { weightLb: ghost.weightLb ?? null, reps: ghost.reps ?? null })}>
                  Same as last
                </button>
              )}
              {s.kind === 'working' && (
                <button className={`chip set-fail ${s.toFailure ? 'on' : ''}`} aria-pressed={!!s.toFailure} onClick={() => patch(db.sets, s.id, { toFailure: !s.toFailure })}>
                  Failure
                </button>
              )}
              <button
                className="icon-btn"
                aria-label={`Delete set ${i + 1}`}
                onClick={async () => {
                  await softDelete(db.sets, s.id);
                  undo(`Set ${i + 1} deleted`, () => restore(db.sets, s.id));
                }}
              >
                ✕
              </button>
            </div>
            <div className={weighted ? 'set-fields' : 'set-fields one'}>
              {weighted && (
                <Stepper
                  ariaLabel={`Set ${i + 1} weight`}
                  value={s.weightLb}
                  placeholder={ghost.weightLb != null ? String(ghost.weightLb) : '0'}
                  step={5}
                  unit="lb"
                  decimal
                  onChange={(v) => patch(db.sets, s.id, { weightLb: v })}
                />
              )}
              <Stepper
                ariaLabel={`Set ${i + 1} ${s.kind === 'negative' ? 'negative reps' : 'reps'}`}
                value={s.reps}
                placeholder={ghost.reps != null ? String(ghost.reps) : '0'}
                step={1}
                unit={s.kind === 'negative' ? 'neg' : 'reps'}
                onChange={(v) => patch(db.sets, s.id, { reps: v })}
              />
            </div>
          </div>
        );
      })}

      <div className="set-add">
        <button className="btn btn-secondary btn-sm" onClick={() => add('warmup')}>
          + Warm-up
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => add('working')}>
          + Working
        </button>
        <button className="btn btn-secondary btn-sm" disabled={!entry.sets.length} onClick={() => add('drop')}>
          + Drop
        </button>
        <button className="btn btn-secondary btn-sm" disabled={!entry.sets.length} onClick={() => add('negative')}>
          + Negatives
        </button>
      </div>
    </div>
  );
}

// ---------- Cardio: time · distance · intervals ----------

export function TimedLogger({ entry, last }: { entry: EntryNode; last: LastTime | null }) {
  const t = entry.timed;
  const plan = entry.planItem;
  const lt = last?.timed;
  const iv = t?.intervals;
  const [showIv, setShowIv] = useState(!!(iv?.rounds || plan?.targetIntervals?.rounds || lt?.intervals?.rounds));
  const ghostMin = lt?.durationS ? Math.round(lt.durationS / 60) : plan?.targetDurationS ? Math.round(plan.targetDurationS / 60) : null;
  const ghostMi = lt?.distanceMi ?? plan?.targetDistanceMi ?? null;
  const ghostIv = lt?.intervals ?? plan?.targetIntervals ?? null;
  const setIv = (k: 'rounds' | 'workS' | 'restS', v: number | null) => {
    const base = { rounds: iv?.rounds ?? ghostIv?.rounds ?? 0, workS: iv?.workS ?? ghostIv?.workS ?? 0, restS: iv?.restS ?? ghostIv?.restS ?? 0 };
    upsertTimed(entry.id, { intervals: { ...base, [k]: v ?? 0 } });
  };
  return (
    <div className="stack">
      <div className="grid-2">
        <label className="field-row">
          <span className="label">Minutes</span>
          <Stepper ariaLabel="Minutes" value={t?.durationS ? Math.round(t.durationS / 60) : null} placeholder={ghostMin != null ? String(ghostMin) : '0'} step={5} onChange={(v) => upsertTimed(entry.id, { durationS: v != null ? v * 60 : null })} />
        </label>
        <label className="field-row">
          <span className="label">Miles</span>
          <Stepper ariaLabel="Miles" decimal value={t?.distanceMi} placeholder={ghostMi != null ? String(ghostMi) : '0'} step={0.5} onChange={(v) => upsertTimed(entry.id, { distanceMi: v })} />
        </label>
      </div>
      <label className="field-row">
        <span className="label">Zone / intensity</span>
        <AutoText value={t?.zone ?? ''} onSave={(v) => upsertTimed(entry.id, { zone: v || null })} placeholder={plan?.targetZone ?? lt?.zone ?? 'e.g. 2'} ariaLabel="Zone" />
      </label>
      {showIv ? (
        <div className="field-row">
          <span className="label">Intervals</span>
          <div className="grid-3 iv">
            <label className="field-row">
              <span className="hint">Rounds</span>
              <Stepper ariaLabel="Rounds" value={iv?.rounds || null} placeholder={ghostIv?.rounds ? String(ghostIv.rounds) : '0'} step={1} onChange={(v) => setIv('rounds', v)} />
            </label>
            <label className="field-row">
              <span className="hint">Work min</span>
              <Stepper ariaLabel="Work minutes" decimal value={iv?.workS ? iv.workS / 60 : null} placeholder={ghostIv?.workS ? String(ghostIv.workS / 60) : '0'} step={0.5} onChange={(v) => setIv('workS', v != null ? Math.round(v * 60) : null)} />
            </label>
            <label className="field-row">
              <span className="hint">Rest min</span>
              <Stepper ariaLabel="Rest minutes" decimal value={iv?.restS ? iv.restS / 60 : null} placeholder={ghostIv?.restS ? String(ghostIv.restS / 60) : '0'} step={0.5} onChange={(v) => setIv('restS', v != null ? Math.round(v * 60) : null)} />
            </label>
          </div>
        </div>
      ) : (
        <button className="link-btn" style={{ justifySelf: 'start' }} onClick={() => setShowIv(true)}>
          + Intervals
        </button>
      )}
    </div>
  );
}

// ---------- Blue collar / rest / flexibility: time · effort ----------

export function EffortLogger({ entry, last }: { entry: EntryNode; last: LastTime | null }) {
  const e = entry.effort;
  const ghostMin = last?.effort?.durationS ? Math.round(last.effort.durationS / 60) : entry.planItem?.targetDurationS ? Math.round(entry.planItem.targetDurationS / 60) : null;
  return (
    <div className="stack">
      <label className="field-row">
        <span className="label">Minutes</span>
        <Stepper ariaLabel="Minutes" value={e?.durationS ? Math.round(e.durationS / 60) : null} placeholder={ghostMin != null ? String(ghostMin) : '0'} step={5} onChange={(v) => upsertEffort(entry.id, { durationS: v != null ? v * 60 : null })} />
      </label>
      <div className="field-row">
        <span className="label">Effort</span>
        <RatingKeys label="Effort" value={e?.effort} onChange={(v) => upsertEffort(entry.id, { effort: v })} lowHint="Easy" highHint="All out" />
      </div>
      <label className="field-row">
        <span className="label">Note</span>
        <AutoText value={e?.note ?? ''} onSave={(v) => upsertEffort(entry.id, { note: v })} placeholder="What did you work on?" ariaLabel="Note" />
      </label>
    </div>
  );
}
