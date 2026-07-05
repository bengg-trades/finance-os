"use client";

// Bottom-sheet editor for retagging any transaction (pending or approved).
// Saving also upserts the merchant rule, so a correction teaches future
// imports exactly like a review-board approval does.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { usd } from "@/lib/format";
import { cardBadge } from "@/lib/cards";

export interface EditableTxn {
  id: string;
  description: string;
  amount_cents: number;
  txn_date: string;
  txn_type: string;
  status: string;
  spend_type: "personal" | "business" | null;
  category_id: string | null;
  card_name: string | null;
  merchant_norm: string;
}

export interface SavedTag {
  id: string;
  spend_type: "personal" | "business";
  category_id: string | null;
  category_name: string | null;
}

interface Category {
  id: string;
  name: string;
  scope: "business" | "personal";
}

export default function EditTxnSheet({
  txn,
  onClose,
  onSaved,
}: {
  txn: EditableTxn | null;
  onClose: () => void;
  onSaved: (saved: SavedTag) => void;
}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [side, setSide] = useState<"personal" | "business">("personal");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    createClient()
      .from("categories")
      .select("id, name, scope")
      .order("name")
      .then(({ data }) => setCategories((data as Category[]) ?? []));
  }, []);

  useEffect(() => {
    if (!txn) return;
    setSide(txn.spend_type === "business" ? "business" : "personal");
    setCategoryId(txn.category_id);
  }, [txn]);

  if (!txn) return null;

  const sideCategories = categories.filter((c) => c.scope === side);
  const badge = cardBadge(txn.card_name);

  function switchSide(next: "personal" | "business") {
    if (next === side) return;
    // keep a same-name category across sides (Travel → Travel), else clear
    const current = categories.find((c) => c.id === categoryId);
    const remapped = current
      ? (categories.find((c) => c.scope === next && c.name === current.name)
          ?.id ?? null)
      : null;
    setSide(next);
    setCategoryId(remapped);
  }

  async function save() {
    if (!txn) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("transactions")
      .update({ spend_type: side, category_id: categoryId })
      .eq("id", txn.id);

    // A correction is the strongest signal — update the merchant rule
    if (txn.txn_type === "purchase" && categoryId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("merchant_rules").upsert(
          {
            user_id: user.id,
            merchant_norm: txn.merchant_norm,
            category_id: categoryId,
            spend_type: side,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id,merchant_norm" }
        );
      }
    }
    setSaving(false);
    onSaved({
      id: txn.id,
      spend_type: side,
      category_id: categoryId,
      category_name:
        categories.find((c) => c.id === categoryId)?.name ?? null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="close"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
      />
      <div className="relative w-full max-w-lg rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <div className="mb-4">
          <div className="flex justify-between gap-3">
            <p className="text-sm font-semibold">{txn.description}</p>
            <p className="shrink-0 text-sm font-bold">
              {usd(txn.amount_cents)}
            </p>
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-neutral-400">
            <span
              className={`rounded px-1 py-px font-medium ${badge.className}`}
            >
              {badge.short}
            </span>
            {txn.txn_date}
            {txn.status === "approved" && (
              <span className="rounded bg-green-50 px-1 text-green-600">
                approved
              </span>
            )}
          </p>
        </div>

        {txn.txn_type === "purchase" ? (
          <>
            <div className="mb-3 flex gap-2">
              {(["personal", "business"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => switchSide(s)}
                  className={`flex-1 rounded-lg py-2.5 text-sm font-medium capitalize ${
                    side === s
                      ? s === "business"
                        ? "bg-blue-600 text-white"
                        : "bg-neutral-900 text-white"
                      : "border border-neutral-200 bg-neutral-50 text-neutral-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <select
              value={categoryId ?? ""}
              onChange={(e) => setCategoryId(e.target.value || null)}
              className="mb-4 w-full rounded-lg border border-neutral-300 px-3 py-2.5 text-sm"
            >
              <option value="">— category —</option>
              {sideCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </>
        ) : (
          <p className="mb-4 rounded-lg bg-neutral-50 p-3 text-xs text-neutral-500">
            This is a {txn.txn_type} — it isn&apos;t categorized spending, but
            you can still move it between personal and business.
            <span className="mt-2 flex gap-2">
              {(["personal", "business"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => switchSide(s)}
                  className={`flex-1 rounded-lg py-2 text-xs font-medium capitalize ${
                    side === s
                      ? "bg-neutral-900 text-white"
                      : "border border-neutral-200 bg-white text-neutral-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </span>
          </p>
        )}

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
