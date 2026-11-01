import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isStandalone } from '../components/Banners';
import { IconChevron } from '../components/Icons';
import { Wordmark } from '../components/Wordmark';
import { db } from '../db/schema';
import './settings.css';

export function Settings() {
  const typeCount = useLiveQuery(() => db.workoutTypes.filter((t) => !t.deletedAt && !t.archived).count(), []);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(false));
  }, []);

  return (
    <div className="screen">
      <div className="screen-head">
        <h1>Settings</h1>
      </div>

      <p className="label settings-group">Planning</p>
      <ul className="rows">
        <li>
          <Link to="/settings/planning" className="row">
            <span>
              <span className="row-title">Workout library &amp; plan</span>
              <span className="row-sub">{typeCount ?? '–'} workout types</span>
            </span>
            <IconChevron />
          </Link>
        </li>
      </ul>

      <p className="label settings-group">This device</p>
      <ul className="rows">
        <li className="row">
          <span className="row-title">Installed to Home Screen</span>
          <span className={`pip ${isStandalone() ? '' : 'warn'} label`}>{isStandalone() ? 'Yes' : 'No'}</span>
        </li>
        <li className="row">
          <span className="row-title">Storage protected</span>
          <span className={`pip ${persisted ? '' : 'warn'} label`}>{persisted === null ? '…' : persisted ? 'Yes' : 'No'}</span>
        </li>
        <li className="row">
          <span className="row-title">Account &amp; sync</span>
          <span className="label">Phase 3</span>
        </li>
      </ul>

      <DisplayDiagnostics />

      <div className="settings-version">
        <Wordmark className="settings-wm" />
        <span className="label">v{__APP_VERSION__}</span>
      </div>
    </div>
  );
}

/** Temporary: screen/viewport measurements to diagnose iOS layout (bottom-bar gap). */
function DisplayDiagnostics() {
  const [info, setInfo] = useState<string>('');
  useEffect(() => {
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom) 0';
    document.body.appendChild(probe);
    const cs = getComputedStyle(probe);
    const rows = [
      `screen ${screen.width}×${screen.height}`,
      `inner ${window.innerWidth}×${window.innerHeight}`,
      `client ${document.documentElement.clientHeight}`,
      `visual ${Math.round(window.visualViewport?.height ?? 0)}`,
      `safe top ${cs.paddingTop} · bottom ${cs.paddingBottom}`,
      `bottom fix ${getComputedStyle(document.documentElement).getPropertyValue('--vh-gap').trim() || '0px'}`,
    ];
    probe.remove();
    setInfo(rows.join('\n'));
  }, []);
  return (
    <>
      <p className="label settings-group">Display diagnostics</p>
      <pre className="diag">{info}</pre>
    </>
  );
}
