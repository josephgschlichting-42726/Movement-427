import { useEffect, useState } from 'react';
import { Wordmark } from './Wordmark';

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Launch splash: the wordmark builds in (~0.8s), holds briefly, then fades away.
 * Tap anywhere to skip. Shown once per cold launch.
 */
export function Splash() {
  const [phase, setPhase] = useState<'show' | 'leave' | 'gone'>('show');

  useEffect(() => {
    const hold = reduced() ? 500 : 1350;
    const t1 = setTimeout(() => setPhase('leave'), hold);
    return () => clearTimeout(t1);
  }, []);

  useEffect(() => {
    if (phase !== 'leave') return;
    const t2 = setTimeout(() => setPhase('gone'), reduced() ? 0 : 280);
    return () => clearTimeout(t2);
  }, [phase]);

  if (phase === 'gone') return null;
  return (
    <div className={`splash ${phase === 'leave' ? 'splash-leave' : ''}`} onClick={() => setPhase('leave')} aria-hidden>
      <Wordmark animate className="splash-wm" />
      <span className="splash-tag label">Plan · Log · Understand</span>
    </div>
  );
}
