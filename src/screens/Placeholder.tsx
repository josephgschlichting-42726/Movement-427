import type { ReactNode } from 'react';

/** Phase-0 stand-in for screens built in later phases. */
export function Placeholder({ title, phase, children }: { title: string; phase: string; children?: ReactNode }) {
  return (
    <div className="screen">
      <div className="screen-head">
        <h1>{title}</h1>
        <span className="label">{phase}</span>
      </div>
      <div className="stack muted">{children}</div>
    </div>
  );
}
