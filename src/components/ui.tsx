import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';

/** Screen header with an optional back link (Oswald title, mono label). */
export function ScreenHead({ title, back, label, right }: { title: string; back?: string; label?: string; right?: ReactNode }) {
  const navigate = useNavigate();
  return (
    <div className="screen-head">
      <div className="screen-head-main">
        {back && (
          <button className="back" onClick={() => (back === '-1' ? navigate(-1) : navigate(back))} aria-label="Back">
            ‹ Back
          </button>
        )}
        {label && <p className="label">{label}</p>}
        <h1>{title}</h1>
      </div>
      {right}
    </div>
  );
}

/** Text input that saves on blur or Enter — autosave, no Save buttons. */
export function AutoText({
  value,
  onSave,
  placeholder,
  className = '',
  ariaLabel,
  autoFocus,
}: {
  value: string;
  onSave: (v: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <input
      className={`field ${className}`}
      value={v}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      autoFocus={autoFocus}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => v !== value && onSave(v.trim())}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Numeric input (decimal keypad on iOS) that saves on blur; empty = null. */
export function AutoNumber({
  value,
  onSave,
  placeholder,
  ariaLabel,
  decimal = false,
}: {
  value: number | null | undefined;
  onSave: (v: number | null) => void;
  placeholder?: string;
  ariaLabel?: string;
  decimal?: boolean;
}) {
  const str = value == null ? '' : String(value);
  const [v, setV] = useState(str);
  useEffect(() => setV(str), [str]);
  return (
    <input
      className="field field-num num"
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={v}
      placeholder={placeholder}
      aria-label={ariaLabel ?? placeholder}
      onChange={(e) => setV(e.target.value.replace(decimal ? /[^0-9.]/g : /[^0-9]/g, ''))}
      onBlur={() => {
        if (v === str) return;
        const n = v === '' ? null : Number(v);
        onSave(n == null || Number.isNaN(n) ? null : n);
      }}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.value}
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'on' : ''}
          disabled={o.disabled}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet. Tap the scrim or Done to close. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);
  if (!open) return null;
  return createPortal(
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal aria-label={title} ref={ref} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="sheet-done" onClick={onClose}>
            Done
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function RowLink({ to, title, sub, right }: { to: string; title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <Link to={to} className="row">
      <span className="row-text">
        <span className="row-title">{title}</span>
        {sub && <span className="row-sub">{sub}</span>}
      </span>
      <span className="row-right">
        {right}
        <span className="chev" aria-hidden>
          ›
        </span>
      </span>
    </Link>
  );
}

export function Empty({ big, children }: { big: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="empty-big" aria-hidden>
        {big}
      </span>
      <div className="muted">{children}</div>
    </div>
  );
}
