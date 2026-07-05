import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Nav from "@/components/Nav";
import { usd, currentMonth, monthLabel, monthRange, shiftMonth } from "@/lib/format";
import { cardBadge } from "@/lib/cards";

// Spending view — always calendar month (1st → end of month) by transaction
// date, never statement period. Payments are transfers and excluded; refunds
// net against spending.

export const dynamic = "force-dynamic";

export default async function SpendingPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const supabase = await createClient();
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(params.month ?? "")
    ? params.month!
    : currentMonth();
  const { start, end } = monthRange(month);

  const { data: txns } = await supabase
    .from("transactions")
    .select(
      "id, txn_date, description, amount_cents, txn_type, status, spend_type, categories(name), cards(name)"
    )
    .gte("txn_date", start)
    .lte("txn_date", end)
    .neq("txn_type", "payment")
    .order("txn_date", { ascending: false });

  const { count: pendingCount } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const all = txns ?? [];
  const total = all.reduce((s, t) => s + t.amount_cents, 0);
  const business = all
    .filter((t) => t.spend_type === "business")
    .reduce((s, t) => s + t.amount_cents, 0);
  const personal = all
    .filter((t) => t.spend_type === "personal")
    .reduce((s, t) => s + t.amount_cents, 0);

  const byCategory = new Map<string, number>();
  for (const t of all) {
    const name =
      (t.categories as unknown as { name: string } | null)?.name ??
      "Uncategorized";
    byCategory.set(name, (byCategory.get(name) ?? 0) + t.amount_cents);
  }
  const categories = [...byCategory.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href={`/?month=${shiftMonth(month, -1)}`}
          className="rounded-lg px-3 py-1 text-neutral-500"
        >
          ←
        </Link>
        <h1 className="text-lg font-bold">{monthLabel(month)}</h1>
        <Link
          href={`/?month=${shiftMonth(month, 1)}`}
          className="rounded-lg px-3 py-1 text-neutral-500"
        >
          →
        </Link>
      </div>

      <div className="mb-2 rounded-2xl bg-neutral-900 p-5 text-white">
        <p className="text-sm text-neutral-400">Total spending</p>
        <p className="text-3xl font-bold">{usd(total)}</p>
        <div className="mt-3 flex gap-6 text-sm">
          <span>
            <span className="text-neutral-400">Business </span>
            {usd(business)}
          </span>
          <span>
            <span className="text-neutral-400">Personal </span>
            {usd(personal)}
          </span>
        </div>
      </div>

      {(pendingCount ?? 0) > 0 && (
        <Link
          href="/review"
          className="mb-4 block rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {pendingCount} transaction{pendingCount === 1 ? "" : "s"} waiting for
          your review — totals may shift until approved.
        </Link>
      )}

      <h2 className="mb-2 mt-6 text-sm font-semibold text-neutral-500">
        By category
      </h2>
      <div className="mb-6 divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {categories.length === 0 && (
          <p className="p-4 text-sm text-neutral-400">
            No transactions this month yet. Upload a statement to get started.
          </p>
        )}
        {categories.map(([name, cents]) => (
          <div key={name} className="flex justify-between px-4 py-3 text-sm">
            <span>{name}</span>
            <span className="font-medium">{usd(cents)}</span>
          </div>
        ))}
      </div>

      <h2 className="mb-2 text-sm font-semibold text-neutral-500">
        Transactions
      </h2>
      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {all.map((t) => (
          <div key={t.id} className="px-4 py-3">
            <div className="flex justify-between gap-3">
              <span className="truncate text-sm">{t.description}</span>
              <span className="shrink-0 text-sm font-medium">
                {usd(t.amount_cents)}
              </span>
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
              <span>{t.txn_date}</span>
              {(() => {
                const b = cardBadge(
                  (t.cards as unknown as { name: string } | null)?.name
                );
                return (
                  <span className={`rounded px-1 py-px font-medium ${b.className}`}>
                    {b.short}
                  </span>
                );
              })()}
              <span>
                {(t.categories as unknown as { name: string } | null)?.name ??
                  "Uncategorized"}
              </span>
              {t.spend_type === "business" && (
                <span className="rounded bg-blue-50 px-1 text-blue-600">biz</span>
              )}
              {t.status === "pending" && (
                <span className="rounded bg-amber-50 px-1 text-amber-600">
                  pending
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <Nav pendingCount={pendingCount ?? 0} />
    </main>
  );
}
