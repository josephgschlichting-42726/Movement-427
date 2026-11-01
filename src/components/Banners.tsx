import { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { IconShare } from './Icons';

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iOS has no install prompt; tell the user how to add Movement to the Home Screen. */
export function InstallBanner() {
  const [hidden, setHidden] = useState(() => isStandalone());
  if (hidden) return null;
  return (
    <div className="banner" role="note">
      <span>
        Install: tap <IconShare /> then <strong>Add to Home Screen</strong>. Your data stays safest in the installed app.
      </span>
      <button className="banner-dismiss" aria-label="Dismiss" onClick={() => setHidden(true)}>
        ✕
      </button>
    </div>
  );
}

/** A new version never reloads mid-set — the user chooses when. */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className="banner" role="status">
      <span>A new version of Movement is ready.</span>
      <button className="btn btn-secondary" onClick={() => updateServiceWorker(true)}>
        Reload
      </button>
    </div>
  );
}
