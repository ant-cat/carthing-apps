const PATHS = {
  play: <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" fill="currentColor" />,
  pause: (
    <g fill="currentColor">
      <rect x="6" y="5" width="4.2" height="14" rx="1.2" />
      <rect x="13.8" y="5" width="4.2" height="14" rx="1.2" />
    </g>
  ),
  next: (
    <g fill="currentColor">
      <path d="M5 6.2v11.6a.8.8 0 0 0 1.24.67l8.7-5.8a.8.8 0 0 0 0-1.34l-8.7-5.8A.8.8 0 0 0 5 6.2Z" />
      <rect x="16.5" y="5.5" width="2.6" height="13" rx="1" />
    </g>
  ),
  prev: (
    <g fill="currentColor">
      <path d="M19 6.2v11.6a.8.8 0 0 1-1.24.67l-8.7-5.8a.8.8 0 0 1 0-1.34l8.7-5.8A.8.8 0 0 1 19 6.2Z" />
      <rect x="4.9" y="5.5" width="2.6" height="13" rx="1" />
    </g>
  ),
  shuffle: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h3.5c2 0 3.2.9 4.3 2.6l2.4 4.8c1.1 1.7 2.3 2.6 4.3 2.6H20" />
      <path d="M3 17h3.5c1.4 0 2.4-.5 3.2-1.3M13.3 8.3c.8-.8 1.8-1.3 3.2-1.3H20" />
      <path d="m17.5 4.5 2.5 2.5-2.5 2.5M17.5 14.5l2.5 2.5-2.5 2.5" />
    </g>
  ),
  repeat: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 11V9.5A2.5 2.5 0 0 1 6.5 7H19M16.5 4.5 19 7l-2.5 2.5" />
      <path d="M20 13v1.5a2.5 2.5 0 0 1-2.5 2.5H5M7.5 19.5 5 17l2.5-2.5" />
    </g>
  ),
  heart: (
    <path
      d="M12 20.2s-7.6-4.6-9-9.4C2 7.3 4.3 4.5 7.4 4.5c2 0 3.5 1.1 4.6 2.7 1.1-1.6 2.6-2.7 4.6-2.7 3.1 0 5.4 2.8 4.4 6.3-1.4 4.8-9 9.4-9 9.4Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinejoin="round"
    />
  ),
  heartFilled: (
    <path
      d="M12 20.2s-7.6-4.6-9-9.4C2 7.3 4.3 4.5 7.4 4.5c2 0 3.5 1.1 4.6 2.7 1.1-1.6 2.6-2.7 4.6-2.7 3.1 0 5.4 2.8 4.4 6.3-1.4 4.8-9 9.4-9 9.4Z"
      fill="currentColor"
    />
  ),
  lyrics: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M4 6h16M4 10.5h11M4 15h16M4 19.5h8" />
    </g>
  ),
  down: <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />,
  volume: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor" />
      <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />
    </g>
  ),
  mute: (
    <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Z" fill="currentColor" />
      <path d="m16 9.5 5 5M21 9.5l-5 5" />
    </g>
  ),
  phone: (
    <g fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <rect x="7" y="2.5" width="10" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </g>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {PATHS[name]}
    </svg>
  );
}
