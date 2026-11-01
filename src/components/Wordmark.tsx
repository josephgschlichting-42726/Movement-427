import './wordmark.css';

/**
 * The mōv wordmark, styled like the Today date numerals (after the "25" mural):
 * brushed-concrete "m" and "ō" (macron drawn as a solid block) and a signal-orange "v".
 * Letters stand on a floor line and step down left→right; the "v" sinks below it and is
 * cropped, like the Today "1". On the splash they rise up through the floor.
 * The macron is drawn, not typed: Oswald's latin subset has no "ō", and a block bar reads better.
 */
export function Wordmark({
  animate = false,
  floor = true,
  className = '',
}: {
  animate?: boolean;
  floor?: boolean;
  className?: string;
}) {
  return (
    <span className={`wm ${floor ? 'wm-floor' : ''} ${animate ? 'wm-animate' : ''} ${className}`} role="img" aria-label="mōv">
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
