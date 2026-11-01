import { NavLink } from 'react-router-dom';
import { IconHistory, IconLog, IconSettings, IconToday } from './Icons';

const items = [
  { to: '/', label: 'Today', icon: <IconToday />, end: true },
  { to: '/log', label: 'Log', icon: <IconLog />, end: false },
  { to: '/history', label: 'History', icon: <IconHistory />, end: false },
  { to: '/settings', label: 'Settings', icon: <IconSettings />, end: false },
];

export function BottomNav() {
  return (
    <nav className="nav" aria-label="Main">
      {items.map((i) => (
        <NavLink key={i.to} to={i.to} end={i.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
          {i.icon}
          <span>{i.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
