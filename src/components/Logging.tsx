import { useEffect, useState } from 'react';
import type { Rating, SkipReason } from '../db/schema';
import { Sheet } from './ui';
import './logging.css';

/** Five big selector keys (style guide B5): one tap, Oswald numerals. Tap the chosen key again to clear. */
export function RatingKeys({
  value,
  onChange,
  label,
  lowHint,
  highHint,
  size = 'md',
}: {
  value: Rating | null | undefined;
  onChange: (v: Rating | null) => void;
  label: string;
  lowHint?: string;
  highHint?: string;
  size?: 'md' | 'lg';
}) {
  return (
    <div className={`rating rating-${size}`}>
      <div className="rating-keys" role="radiogroup" aria-label={label}>
        {([1, 2, 3, 4, 5] as Rating[]).map((n) => (
          <button key={n} role="radio" aria-checked={value === n} aria-label={`${label} ${n}`} className={value === n ? 'on' : ''} onClick={() => onChange(value === n ? null : n)}>
            {n}
          </button>
        ))}
      </div>
      {(lowHint || highHint) && (
        <div className="rating-hints">
          <span>{lowHint}</span>
          <span>{highHint}</span>
        </div>
      )}
    </div>
  );
}

/**
 * Signature numerals (style guide B7a): gray sinks 0.2em, orange sinks 0.1em, orange overlaps.
 * Used for the joy-to-move start→end summary.
 */
export function Numerals({ a, b, className = '' }: { a: string | number; b: string | number; className?: string }) {
  return (
    <div className={`numerals ${className}`} aria-hidden>
      <span className="numerals-a">{a}</span>
      <span className="numerals-b">{b}</span>
    </div>
  );
}

/** −/+ stepper around a numeric field (decimal keypad on iOS). Saves on every tap and on blur. */
export function Stepper({
  value,
  onChange,
  step,
  min = 0,
  ariaLabel,
  placeholder,
  unit,
  decimal,
}: {
  value: number | null | undefined;
  onChange: (v: number | null) => void;
  step: number;
  min?: number;
  ariaLabel: string;
  placeholder?: string;
  unit?: string;
  decimal?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  // Optimistic value: rapid taps build on the last tap, not on the (async) saved value.
  const [local, setLocal] = useState<number | null | undefined>(undefined);
  useEffect(() => {
    if (local !== undefined && value === local) setLocal(undefined);
  }, [value, local]);
  const current = local !== undefined ? local : value;
  const shown = draft ?? (current == null ? '' : String(current));
  // Bumping from an empty field starts from the ghost value ("last time"), so +5 means last time + 5.
  const base = () => current ?? (placeholder && !Number.isNaN(Number(placeholder)) ? Number(placeholder) : 0);
  const commit = (v: number | null) => {
    setLocal(v);
    onChange(v);
  };
  const bump = (d: number) => commit(Math.max(min, Math.round((base() + d) * 100) / 100));
  return (
    <div className="stepper">
      <button aria-label={`${ariaLabel} minus ${step}`} onClick={() => bump(-step)}>
        −
      </button>
      <label className="stepper-field">
        <input
          inputMode={decimal ? 'decimal' : 'numeric'}
          value={shown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          onFocus={(e) => e.target.select()}
          onChange={(e) => setDraft(e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''))}
          onBlur={() => {
            if (draft != null) commit(draft === '' ? null : Number(draft));
            setDraft(null);
          }}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
        {unit && <span className="stepper-unit">{unit}</span>}
      </label>
      <button aria-label={`${ariaLabel} plus ${step}`} onClick={() => bump(step)}>
        +
      </button>
    </div>
  );
}

export const SKIP_REASONS: { value: SkipReason; label: string }[] = [
  { value: 'sore_injury', label: 'Sore / injury' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'time', label: 'Time' },
  { value: 'energy', label: 'Energy' },
  { value: 'other', label: 'Other' },
];

export const skipLabel = (r?: SkipReason | null) => SKIP_REASONS.find((x) => x.value === r)?.label ?? 'Skipped';

/** Skip with an optional reason — one tap to skip, reason is a bonus. */
export function SkipSheet({ title, onSkip, onClose }: { title: string; onSkip: (reason: SkipReason | null, note: string) => void; onClose: () => void }) {
  const [reason, setReason] = useState<SkipReason | null>(null);
  const [note, setNote] = useState('');
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      footer={
        <button className="btn btn-primary btn-block" onClick={() => onSkip(reason, note.trim())}>
          Skip
        </button>
      }
    >
      <p className="label" style={{ marginBottom: 'var(--space-2)' }}>
        Reason (optional)
      </p>
      <div className="chips">
        {SKIP_REASONS.map((r) => (
          <button key={r.value} className={`chip ${reason === r.value ? 'on' : ''}`} onClick={() => setReason(reason === r.value ? null : r.value)}>
            {r.label}
          </button>
        ))}
      </div>
      <input className="field" style={{ marginTop: 'var(--space-3)' }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note, e.g. sore left foot" aria-label="Skip note" />
      <p className="hint" style={{ marginTop: 'var(--space-3)' }}>
        Skipping never changes your plan, and you can undo it anytime.
      </p>
    </Sheet>
  );
}

/** Daily check-in: sleep, mood, motivation — once per day, editable anytime. */
export function CheckInRows({
  sleep,
  mood,
  motivation,
  onChange,
}: {
  sleep?: Rating | null;
  mood?: Rating | null;
  motivation?: Rating | null;
  onChange: (field: 'sleep' | 'mood' | 'motivation', v: Rating | null) => void;
}) {
  const rows: { f: 'sleep' | 'mood' | 'motivation'; label: string; v?: Rating | null; lo: string; hi: string }[] = [
    { f: 'sleep', label: 'Sleep', v: sleep, lo: 'Rough', hi: 'Great' },
    { f: 'mood', label: 'Mood', v: mood, lo: 'Low', hi: 'Bright' },
    { f: 'motivation', label: 'Drive', v: motivation, lo: 'Flat', hi: 'Fired up' },
  ];
  return (
    <div className="checkin">
      {rows.map((r) => (
        <div key={r.f} className="checkin-row">
          <span className="checkin-label">{r.label}</span>
          <RatingKeys label={r.label} value={r.v} onChange={(v) => onChange(r.f, v)} lowHint={r.lo} highHint={r.hi} />
        </div>
      ))}
    </div>
  );
}
