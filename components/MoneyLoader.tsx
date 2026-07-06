// Money-themed loading state — a gold coin flipping on its axis.
export default function MoneyLoader({
  label = "Counting the money…",
}: {
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <div className="money-coin flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-amber-500 bg-amber-400 text-lg font-bold text-amber-900 shadow-md">
        $
      </div>
      <p className="text-xs text-neutral-400">{label}</p>
    </div>
  );
}
