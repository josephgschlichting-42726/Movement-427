import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { isStandalone } from '../components/Banners';
import { IconChevron } from '../components/Icons';
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

      <p className="settings-version label">Movement v{__APP_VERSION__}</p>
    </div>
  );
}
