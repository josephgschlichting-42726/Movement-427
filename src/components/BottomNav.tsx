import { NavLink } from 'react-router-dom';
import { useSyncStatus } from '../sync/sync';
import { IconHistory, IconLog, IconSettings, IconToday } from './Icons';

const items = [
  { to: '/', label: 'Today', icon: <IconToday />, end: true },
  { to: '/log', label: 'Log', icon: <IconLog />, end: false },
  { to: '/history', label: 'History', icon: <IconHistory />, end: false },
  { to: '/settings', label: 'Settings', icon: <IconSettings />, end: false },
];

export function BottomNav() {
  const sync = useSyncStatus();
  // A small pip on Settings when something needs attention (signed out, waiting, error).
  const pip = sync.state === 'error' ? 'err' : sync.state === 'signed-out' || sync.state === 'pending' || sync.state === 'offline' ? 'warn' : null;
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          {i.icon}
          {i.to === '/settings' && pip && <span className={`nav-pip ${pip === 'err' ? 'err' : ''}`} aria-label="Sync needs attention" />}
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
