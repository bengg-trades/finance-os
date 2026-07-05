"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import EditTxnSheet, { EditableTxn } from "./EditTxnSheet";
import { usd } from "@/lib/format";
import { cardBadge } from "@/lib/cards";

export interface TxnListRow extends EditableTxn {
  category_name: string | null;
}

// Tappable transaction list (Spending page) — tap any row to retag it.
export default function TxnList({ rows }: { rows: TxnListRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TxnListRow | null>(null);

  return (
    <>
      <div className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 bg-white">
        {rows.map((t) => {
          const badge = cardBadge(t.card_name);
          return (
            <button
              key={t.id}
              onClick={() => setEditing(t)}
              className="block w-full px-4 py-3 text-left active:bg-neutral-50"
            >
              <div className="flex justify-between gap-3">
                <span className="truncate text-sm">{t.description}</span>
                <span className="shrink-0 text-sm font-medium">
                  {usd(t.amount_cents)}
                </span>
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                <span>{t.txn_date}</span>
                <span
                  className={`rounded px-1 py-px font-medium ${badge.className}`}
                >
                  {badge.short}
                </span>
                <span>{t.category_name ?? "Uncategorized"}</span>
                {t.spend_type === "business" && (
                  <span className="rounded bg-blue-50 px-1 text-blue-600">
                    biz
                  </span>
                )}
                {t.status === "pending" && (
                  <span className="rounded bg-amber-50 px-1 text-amber-600">
                    pending
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <EditTxnSheet
        txn={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          router.refresh(); // totals + category groupings re-render server-side
        }}
      />
    </>
  );
}
