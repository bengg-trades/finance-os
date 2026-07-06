// FINANCE OS mark — dark tile, ascending bars, gold coin.
// Same artwork as app/icon.svg (favicon) and app/apple-icon.tsx (home screen).
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="FINANCE OS"
    >
      <rect width="64" height="64" rx="14" fill="#171717" />
      <rect x="10" y="38" width="8" height="14" rx="2" fill="#22c55e" opacity="0.55" />
      <rect x="22" y="30" width="8" height="22" rx="2" fill="#22c55e" opacity="0.75" />
      <rect x="34" y="20" width="8" height="32" rx="2" fill="#22c55e" />
      <circle cx="48" cy="18" r="10" fill="#fbbf24" stroke="#d97706" strokeWidth="2" />
      <text
        x="48"
        y="22.5"
        textAnchor="middle"
        fontSize="13"
        fontWeight="bold"
        fill="#92400e"
        fontFamily="system-ui, sans-serif"
      >
        $
      </text>
    </svg>
  );
}
