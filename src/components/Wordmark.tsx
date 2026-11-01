import './wordmark.css';

/**
 * The mōv wordmark, styled like the Today date numerals (after the "25" mural):
 * brushed-concrete "m" and "ō" (macron = the long-vowel mark, drawn as a solid block),
 * and a signal-orange "v" overlapping the "ō".
 * The macron is drawn, not typed: Oswald's latin subset has no "ō", and a block bar reads better.
 */
export function Wordmark({ animate = false, className = '' }: { animate?: boolean; className?: string }) {
  return (
    <span className={`wm ${animate ? 'wm-animate' : ''} ${className}`} role="img" aria-label="mōv">
      <span className="wm-l wm-m" aria-hidden>
        m
      </span>
      <span className="wm-l wm-o" aria-hidden>
        o<span className="wm-macron" />
      </span>
      <span className="wm-l wm-v" aria-hidden>
        v
      </span>
    </span>
  );
}
