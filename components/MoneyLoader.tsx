// Money-themed loading state — the logo's bars, breathing.
export default function MoneyLoader({
  label = "Counting the money…",
}: {
  label?: string;
}) {
  return (
    <div
      className="flex flex-col items-center gap-3 py-12"
      role="status"
      aria-label={label}
    >
      <div className="money-bars" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <p className="text-xs text-neutral-400">{label}</p>
    </div>
  );
}
