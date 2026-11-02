import './wordmark.css';

/**
 * The mo͞oV wordmark — locked version (docs/reference/wordmark-approved.png).
 * Spelled like the dictionary respelling of "move" (/mo͞ov/): two o's under one bar.
 * Follows the Today date-numeral rules exactly (style guide B7a/B7b):
 *   - every letter the same size
 *   - gray (brushed concrete) letters sink 0.2em below the floor
 *   - the orange capital V sinks 0.1em, so it stands taller — cap height, like the digits
 *   - the orange overlaps the gray by 0.13em
 * The bar is drawn, not typed (a solid concrete block spanning both o's).
 * On the splash the letters rise up through the floor.
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
    <span className={`wm ${floor ? 'wm-floor' : ''} ${animate ? 'wm-animate' : ''} ${className}`} role="img" aria-label="moov (move)">
      <span className="wm-l wm-m" aria-hidden>
        m
      </span>
      <span className="wm-oo" aria-hidden>
        <span className="wm-l wm-o wm-o1">o</span>
        <span className="wm-l wm-o wm-o2">o</span>
        <span className="wm-macron" />
      </span>
      <span className="wm-l wm-v" aria-hidden>
        V
      </span>
    </span>
  );
}
