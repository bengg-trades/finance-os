"use client";

// Review board — every pending transaction lands here, pre-placed by the AI
// into Personal or Business. Drag a card to the other column to flip it,
// tweak the category on the card, then Approve All. Nothing is final until
// approved, and every approval teaches the app (merchant rules).

import { useCallback, useEffect, useState } from "react";
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import { usd } from "@/lib/format";

type SpendType = "personal" | "business";

interface PendingTxn {
  id: string;
  txn_date: string;
  description: string;
  amount_cents: number;
  txn_type: string;
  merchant_norm: string;
  category_id: string | null;
  spend_type: SpendType | null;
  ai_confidence: number | null;
  cards: { name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

function TxnCard({
  txn,
  categories,
  onCategoryChange,
}: {
  txn: PendingTxn;
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: txn.id });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={
        transform
          ? {
              transform: `translate(${transform.x}px, ${transform.y}px)`,
              zIndex: 50,
              position: "relative" as const,
            }
          : undefined
      }
      className={`touch-none rounded-lg border bg-white p-2.5 shadow-sm ${
        isDragging ? "border-neutral-400 opacity-90 shadow-lg" : "border-neutral-200"
      }`}
    >
      <div className="flex justify-between gap-2">
        <span className="truncate text-xs font-medium">{txn.description}</span>
        <span className="shrink-0 text-xs font-semibold">
          {usd(txn.amount_cents)}
        </span>
      </div>
      <p className="mt-0.5 text-[10px] text-neutral-400">
        {txn.txn_date} · {txn.cards?.name}
        {txn.txn_type === "payment" && (
          <span className="ml-1 rounded bg-neutral-100 px-1 text-neutral-500">
            card payment — not spending
          </span>
        )}
        {txn.txn_type === "refund" && (
          <span className="ml-1 rounded bg-green-100 px-1 text-green-700">
            refund
          </span>
        )}
        {txn.ai_confidence !== null && txn.ai_confidence < 0.7 && (
          <span className="ml-1 rounded bg-amber-100 px-1 text-amber-700">
            AI unsure
          </span>
        )}
      </p>
      {txn.txn_type === "purchase" && (
        <select
          value={txn.category_id ?? ""}
          onChange={(e) => onCategoryChange(txn.id, e.target.value || null)}
          onPointerDown={(e) => e.stopPropagation()}
          className="mt-1.5 w-full rounded border border-neutral-200 bg-neutral-50 px-1 py-1 text-[11px]"
        >
          <option value="">— category —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function Column({
  type,
  label,
  txns,
  categories,
  onCategoryChange,
}: {
  type: SpendType;
  label: string;
  txns: PendingTxn[];
  categories: Category[];
  onCategoryChange: (id: string, categoryId: string | null) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: type });
  // Card payments are transfers, not spending — they never count in totals.
  // Refunds stay: a return genuinely reduces what was spent.
  const total = txns
    .filter((t) => t.txn_type !== "payment")
    .reduce((s, t) => s + t.amount_cents, 0);

  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[60dvh] flex-1 flex-col gap-2 rounded-xl border-2 p-2 transition-colors ${
        isOver
          ? "border-green-400 bg-green-50"
          : type === "business"
            ? "border-blue-200 bg-blue-50/50"
            : "border-neutral-200 bg-neutral-50"
      }`}
    >
      <div className="px-1 pb-1">
        <p className="text-sm font-bold">
          {label}
          <span className="ml-2 font-normal text-neutral-400">
            {txns.length}
          </span>
        </p>
        <p className="text-xs text-neutral-500">{usd(total)}</p>
      </div>
      {txns.map((t) => (
        <TxnCard
          key={t.id}
          txn={t}
          categories={categories}
          onCategoryChange={onCategoryChange}
        />
      ))}
    </div>
  );
}

export default function ReviewBoardPage() {
  const [txns, setTxns] = useState<PendingTxn[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [categorizing, setCategorizing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Distance activation keeps taps working for the category dropdowns
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  const load = useCallback(async () => {
    const supabase = createClient();
    const [txnRes, catRes] = await Promise.all([
      supabase
        .from("transactions")
        .select(
          "id, txn_date, description, amount_cents, txn_type, merchant_norm, category_id, spend_type, ai_confidence, cards(name)"
        )
        .eq("status", "pending")
        .order("txn_date", { ascending: false }),
      supabase.from("categories").select("id, name").order("name"),
    ]);
    setTxns((txnRes.data as unknown as PendingTxn[]) ?? []);
    setCategories(catRes.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;
    const target = over.id as SpendType;
    const txn = txns.find((t) => t.id === active.id);
    if (!txn || txn.spend_type === target) return;

    setTxns((prev) =>
      prev.map((t) => (t.id === txn.id ? { ...t, spend_type: target } : t))
    );
    const supabase = createClient();
    await supabase
      .from("transactions")
      .update({ spend_type: target })
      .eq("id", txn.id);
  }

  async function handleCategoryChange(id: string, categoryId: string | null) {
    setTxns((prev) =>
      prev.map((t) => (t.id === id ? { ...t, category_id: categoryId } : t))
    );
    const supabase = createClient();
    await supabase
      .from("transactions")
      .update({ category_id: categoryId })
      .eq("id", id);
  }

  async function approveAll() {
    setApproving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    await supabase
      .from("transactions")
      .update({ status: "approved" })
      .in(
        "id",
        txns.map((t) => t.id)
      );

    // Learn from this batch: one rule per merchant
    if (user) {
      const rules = new Map<
        string,
        { category_id: string | null; spend_type: string | null }
      >();
      for (const t of txns) {
        if (t.txn_type === "purchase" && t.category_id) {
          rules.set(t.merchant_norm, {
            category_id: t.category_id,
            spend_type: t.spend_type,
          });
        }
      }
      if (rules.size > 0) {
        await supabase.from("merchant_rules").upsert(
          [...rules.entries()].map(([merchant_norm, r]) => ({
            user_id: user.id,
            merchant_norm,
            category_id: r.category_id,
            spend_type: r.spend_type,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "user_id,merchant_norm" }
        );
      }
    }

    setTxns([]);
    setApproving(false);
  }

  async function runAiCategorize() {
    setCategorizing(true);
    setNotice(null);
    try {
      const res = await fetch("/api/categorize", { method: "POST" });
      const body = await res.json();
      if (body.error) setNotice(body.error);
      else
        setNotice(
          `Categorized ${body.categorized} with AI, ${body.from_rules} from your past approvals.`
        );
      await load();
    } catch (err) {
      setNotice(String(err));
    }
    setCategorizing(false);
  }

  const personal = txns.filter((t) => t.spend_type !== "business");
  const business = txns.filter((t) => t.spend_type === "business");
  const uncategorizedCount = txns.filter(
    (t) => t.txn_type === "purchase" && !t.category_id
  ).length;

  return (
    <main className="mx-auto max-w-lg px-3 pb-32 pt-6">
      <h1 className="mb-1 px-1 text-lg font-bold">Review board</h1>
      <p className="mb-4 px-1 text-sm text-neutral-500">
        The AI placed everything below. Drag cards between columns to fix the
        split, adjust categories, then approve.
      </p>

      {uncategorizedCount > 0 && !loading && (
        <button
          onClick={runAiCategorize}
          disabled={categorizing}
          className="mb-3 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {categorizing
            ? "AI is categorizing…"
            : `AI categorize ${uncategorizedCount} uncategorized`}
        </button>
      )}
      {notice && (
        <p className="mb-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800">
          {notice}
        </p>
      )}

      {loading ? (
        <p className="px-1 text-sm text-neutral-400">Loading…</p>
      ) : txns.length === 0 ? (
        <p className="rounded-xl bg-green-50 p-4 text-sm text-green-800">
          All caught up — nothing waiting for review.
        </p>
      ) : (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="flex gap-2">
            <Column
              type="personal"
              label="Personal"
              txns={personal}
              categories={categories}
              onCategoryChange={handleCategoryChange}
            />
            <Column
              type="business"
              label="Business"
              txns={business}
              categories={categories}
              onCategoryChange={handleCategoryChange}
            />
          </div>
        </DndContext>
      )}

      {txns.length > 0 && (
        <div className="fixed inset-x-0 bottom-12 z-10 mx-auto max-w-lg px-4 pb-2">
          <button
            onClick={approveAll}
            disabled={approving}
            className="w-full rounded-xl bg-green-600 py-3 font-semibold text-white shadow-lg disabled:opacity-50"
          >
            {approving
              ? "Approving…"
              : `Approve all ${txns.length} as placed`}
          </button>
        </div>
      )}

      <Nav pendingCount={txns.length} />
    </main>
  );
}
