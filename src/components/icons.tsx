// Small hand-rolled icon set — no icon-library dependency. Each icon
// is a plain stroke SVG using `currentColor`, so it inherits whatever
// text color its container sets (including the brand/semantic tokens
// in globals.css). Sized via the `size` prop, default 24.

type IconProps = { size?: number; className?: string };

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function OrderIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M6 3h12l-1 15.5a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 3Z" />
      <path d="M9 3v-.5A2.5 2.5 0 0 1 11.5 0h1A2.5 2.5 0 0 1 15 2.5V3" />
      <path d="M9 10h6M9 14h4" />
    </svg>
  );
}

export function KitchenIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 2c-1.2 2-3.2 3.6-3.2 6.4a3.2 3.2 0 0 0 6.4 0c0-1-.4-1.8-.9-2.5.3 1.4-.3 2.3-1 2.3-1 0-1-1-.5-2C13.4 5 12.8 3.4 12 2Z" />
      <path d="M6 14a6 6 0 0 0 12 0H6Z" />
      <path d="M5 18h14" />
    </svg>
  );
}

export function TableIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M3 8h18M5 8v3.5M19 8v3.5M7.5 11.5h9l-1 9h-7l-1-9Z" />
    </svg>
  );
}

export function ReportsIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  );
}

export function AdminIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13.5a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6V20a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H4a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H10a1.7 1.7 0 0 0 1-1.6V4a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V10a1.7 1.7 0 0 0 1.6 1H20a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.6 1Z" />
    </svg>
  );
}

export function ShieldIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 2.5 5 5.5v5.3c0 4.7 3 8.8 7 10.2 4-1.4 7-5.5 7-10.2V5.5L12 2.5Z" />
      <path d="M9.3 12l1.8 1.8 3.6-3.8" />
    </svg>
  );
}

export function PeopleIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <path d="M16.5 6.5a2.5 2.5 0 0 1 0 5" />
      <path d="M19 20c0-2.6-1.6-4.8-4-5.7" />
    </svg>
  );
}

export function MenuBookIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15.5A1.5 1.5 0 0 1 18.5 20H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" />
      <path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20" />
      <path d="M8 7h8M8 10.5h5" />
    </svg>
  );
}

export function TenantsIcon({ size = 24, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M4 21V9l8-5 8 5v12" />
      <path d="M4 21h16M9 21v-6h6v6" />
    </svg>
  );
}

export function FlameBadgeIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <path d="M12 2c-1.2 2-3.2 3.6-3.2 6.4a3.2 3.2 0 0 0 6.4 0c0-1-.4-1.8-.9-2.5.3 1.4-.3 2.3-1 2.3-1 0-1-1-.5-2C13.4 5 12.8 3.4 12 2Z" />
      <path d="M6 14a6 6 0 0 0 12 0H6Z" />
    </svg>
  );
}

export function CheckBadgeIcon({ size = 16, className }: IconProps) {
  return (
    <svg {...base} width={size} height={size} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.2l2.2 2.2 4.8-5" />
    </svg>
  );
}
