// Minimal geometric line icons (1.75px stroke, square caps) — style guide §5.
import type { SVGProps } from 'react';

const base: SVGProps<SVGSVGElement> = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
  'aria-hidden': true,
};

export const IconToday = () => (
  <svg {...base}>
    <rect x="3.5" y="4.5" width="17" height="16" />
    <path d="M3.5 9.5h17M8 2.5v4M16 2.5v4" />
    <rect x="7.5" y="13" width="4" height="4" fill="currentColor" stroke="none" />
  </svg>
);

export const IconLog = () => (
  <svg {...base}>
    <path d="M2.5 12h2M19.5 12h2" />
    <rect x="4.5" y="7" width="3" height="10" />
    <rect x="16.5" y="7" width="3" height="10" />
    <path d="M7.5 12h9" />
  </svg>
);

export const IconHistory = () => (
  <svg {...base}>
    <path d="M3.5 20.5h17" />
    <path d="M6 20.5v-6M10.5 20.5v-10M15 20.5v-7.5M19.5 20.5v-13" />
  </svg>
);

export const IconSettings = () => (
  <svg {...base}>
    <path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1" />
    <rect x="13" y="4.5" width="4" height="4" />
    <rect x="7" y="10" width="4" height="4" />
    <rect x="15" y="15.5" width="4" height="4" />
  </svg>
);

export const IconChevron = () => (
  <svg {...base} width={20} height={20}>
    <path d="M9 5.5l6.5 6.5L9 18.5" />
  </svg>
);

export const IconShare = () => (
  <svg {...base} width={18} height={18} style={{ verticalAlign: '-3px' }}>
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" />
    <path d="M5 11v9.5h14V11" />
  </svg>
);
