import { useEffect, useState } from 'react';
import { Wordmark } from './Wordmark';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Timeline (ms). Intro ≈ 1.5s, a calm hold, then a ~0.95s cross-fade into the home screen. */
const HOLD_UNTIL = 2300;
const HOLD_UNTIL_REDUCED = 800;
const FADE = 950;
const FADE_REDUCED = 400;

/**
 * Launch splash. The wordmark builds in, holds, then cross-fades with the home screen:
 * `onLeave` fires as the fade starts so the app fades in on the same curve — midway
 * through, both are half-visible. Tap anywhere to skip straight to the cross-fade.
 */
export function Splash({ onLeave }: { onLeave: () => void }) {
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>('show');

  useEffect(() => {
    const t = setTimeout(() => setPhase('leave'), reduced() ? HOLD_UNTIL_REDUCED : HOLD_UNTIL);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== 'leave') return;
    onLeave();
    const t = setTimeout(() => setPhase('gone'), reduced() ? FADE_REDUCED : FADE);
    return () => clearTimeout(t);
  }, [phase, onLeave]);

  if (phase === 'gone') return null;
  return (
    <div className={`splash ${phase === 'leave' ? 'splash-leave' : ''}`} onClick={() => setPhase('leave')} aria-hidden>
      <Wordmark animate className="splash-wm" />
      <span className="splash-tag label">Plan · Log · Understand</span>
    </div>
  );
}
