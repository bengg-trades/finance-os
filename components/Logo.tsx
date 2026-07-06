// FINANCE OS mark — dark tile, three ascending bars, gold cap on the tallest
// (the "coin" absorbed into the chart). Same artwork as app/icon.svg (favicon)
// and app/apple-icon.tsx (home screen).
export default function Logo({ size = 40 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="FINANCE OS"
    >
      <rect width="64" height="64" rx="14" fill="#101b14" />
      <rect x="12" y="39" width="10" height="13" rx="2.5" fill="#2f9e63" />
      <rect x="27" y="29" width="10" height="23" rx="2.5" fill="#3cc878" />
      <rect x="42" y="27" width="10" height="25" rx="2.5" fill="#52e695" />
      <rect x="42" y="14" width="10" height="10" rx="3" fill="#f2b52a" />
    </svg>
  );
}
