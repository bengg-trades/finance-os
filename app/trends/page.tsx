"use client";

// Trends — calendar heatmap of daily spend + categories over months.
// Spending = purchases + fees + interest, net of refunds. Payments excluded.

import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import Nav from "@/components/Nav";
import MoneyLoader from "@/components/MoneyLoader";
import EditTxnSheet, { EditableTxn, SavedTag } from "@/components/EditTxnSheet";
import { usd, monthLabel, shiftMonth } from "@/lib/format";
import { cardBadge } from "@/lib/cards";

interface Txn {
  id: string;
  txn_date: string;
  description: string;
  amount_cents: number;
  txn_type: string;
  status: string;
  merchant_norm: string;
  category_id: string | null;
  spend_type: "personal" | "business" | null;
  categories: { name: string } | null;
  cards: { name: string } | null;
}

function toEditable(t: Txn): EditableTxn {
  return {
    id: t.id,
    description: t.description,
    amount_cents: t.amount_cents,
    txn_date: t.txn_date,
    txn_type: t.txn_type,
    status: t.status,
    spend_type: t.spend_type,
    category_id: t.category_id,
    card_name: t.cards?.name ?? null,
    merchant_norm: t.merchant_norm,
  };
}

type ScopeFilter = "all" | "business" | "personal";

const CHART_COLORS = [
  "#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed",
  "#0891b2", "#db2777", "#65a30d", "#9333ea", "#ea580c",
  "#0d9488", "#4f46e5", "#b91c1c", "#a16207",
];

export default function TrendsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [month, setMonth] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [editing, setEditing] = useState<EditableTxn | null>(null);

  function applySavedTag(saved: SavedTag) {
    setTxns((prev) =>
      prev.map((t) =>
        t.id === saved.id
          ? {
              ...t,
              spend_type: saved.spend_type,
              category_id: saved.category_id,
              categories: saved.category_name
                ? { name: saved.category_name }
                : null,
            }
          : t
      )
    );
    setEditing(null);
  }

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      // Page through everything — PostgREST caps a single request at 1000 rows
      const all: Txn[] = [];
      for (let page = 0; ; page++) {
        const { data } = await supabase
          .from("transactions")
          .select(
            "id, txn_date, description, amount_cents, txn_type, status, merchant_norm, category_id, spend_type, categories(name), cards(name)"
          )
          .neq("txn_type", "payment")
          .order("txn_date", { ascending: true })
          .range(page * 1000, page * 1000 + 999);
        const rows = (data as unknown as Txn[]) ?? [];
        all.push(...rows);
        if (rows.length < 1000) break;
      }
      setTxns(all);
      if (all.length > 0) {
        setMonth(all[all.length - 1].txn_date.slice(0, 7));
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => (scope === "all" ? txns : txns.filter((t) => t.spend_type === scope)),
    [txns, scope]
  );

  // ---- calendar data for the selected month ----
  const calendar = useMemo(() => {
    if (!month) return null;
    const [y, m] = month.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const firstWeekday = new Date(y, m - 1, 1).getDay();
    const byDay = new Map<string, number>();
    for (const t of filtered) {
      if (t.txn_date.slice(0, 7) === month) {
        byDay.set(t.txn_date, (byDay.get(t.txn_date) ?? 0) + t.amount_cents);
      }
    }
    const max = Math.max(1, ...byDay.values());
    const monthTotal = [...byDay.values()].reduce((s, v) => s + v, 0);
    return { daysInMonth, firstWeekday, byDay, max, monthTotal, y, m };
  }, [filtered, month]);

  // ---- categories × months chart data ----
  const chart = useMemo(() => {
    const byMonth = new Map<string, Map<string, number>>();
    const catTotals = new Map<string, number>();
    for (const t of filtered) {
      const mo = t.txn_date.slice(0, 7);
      const cat = t.categories?.name ?? "Uncategorized";
      if (!byMonth.has(mo)) byMonth.set(mo, new Map());
      const catMap = byMonth.get(mo)!;
      catMap.set(cat, (catMap.get(cat) ?? 0) + t.amount_cents);
      catTotals.set(cat, (catTotals.get(cat) ?? 0) + t.amount_cents);
    }
    const categories = [...catTotals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name]) => name);
    const months = [...byMonth.keys()].sort();
    const rows = months.map((mo) => {
      const row: Record<string, number | string> = {
        month: monthLabel(mo).split(" ")[0].slice(0, 3),
        key: mo,
      };
      for (const cat of categories) {
        const cents = byMonth.get(mo)!.get(cat) ?? 0;
        if (cents !== 0) row[cat] = Math.round(cents) / 100;
      }
      return row;
    });
    return { rows, categories };
  }, [filtered]);

  const dayTxns = selectedDay
    ? filtered.filter((t) => t.txn_date === selectedDay)
    : [];

  // ---- month breakdown: categories in the selected month + filtered list ----
  const monthDetail = useMemo(() => {
    if (!month) return null;
    const inMonth = filtered.filter((t) => t.txn_date.slice(0, 7) === month);
    const byCat = new Map<string, { cents: number; count: number }>();
    for (const t of inMonth) {
      const cat = t.categories?.name ?? "Uncategorized";
      const cur = byCat.get(cat) ?? { cents: 0, count: 0 };
      cur.cents += t.amount_cents;
      cur.count += 1;
      byCat.set(cat, cur);
    }
    const categories = [...byCat.entries()].sort(
      (a, b) => b[1].cents - a[1].cents
    );
    const list = (
      selectedCategory
        ? inMonth.filter(
            (t) => (t.categories?.name ?? "Uncategorized") === selectedCategory
          )
        : inMonth
    )
      .slice()
      .sort((a, b) => (a.txn_date < b.txn_date ? 1 : -1));
    return { categories, list };
  }, [filtered, month, selectedCategory]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <main className="mx-auto max-w-lg px-4 pb-24 pt-6">
      <h1 className="mb-4 text-lg font-bold">Trends</h1>

      {/* scope filter */}
      <div className="mb-4 flex gap-2">
        {(["all", "business", "personal"] as ScopeFilter[]).map((s) => (
          <button
            key={s}
            onClick={() => {
              setScope(s);
              setSelectedDay(null);
              setSelectedCategory(null);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize ${
              scope === s
                ? "bg-neutral-900 text-white"
                : "bg-white text-neutral-500 border border-neutral-200"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <MoneyLoader label="Crunching the numbers…" />
      ) : txns.length === 0 ? (
        <p className="text-sm text-neutral-400">
          No data yet — upload statements first.
        </p>
      ) : (
        <>
          {/* ---- calendar ---- */}
          {month && calendar && (
            <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-4">
              <div className="mb-3 flex items-center justify-between">
                <button
                  onClick={() => {
                    setMonth(shiftMonth(month, -1));
                    setSelectedDay(null);
                    setSelectedCategory(null);
                  }}
                  className="rounded px-2 py-1 text-neutral-400"
                >
                  ←
                </button>
                <div className="text-center">
                  <p className="text-sm font-bold">{monthLabel(month)}</p>
                  <p className="text-xs text-neutral-500">
                    {usd(calendar.monthTotal)} spent
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMonth(shiftMonth(month, 1));
                    setSelectedDay(null);
                    setSelectedCategory(null);
                  }}
                  className="rounded px-2 py-1 text-neutral-400"
                >
                  →
                </button>
              </div>

              <div className="grid grid-cols-7 gap-1 text-center">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span key={i} className="text-[10px] text-neutral-400">
                    {d}
                  </span>
                ))}
                {Array.from({ length: calendar.firstWeekday }).map((_, i) => (
                  <span key={`pad-${i}`} />
                ))}
                {Array.from({ length: calendar.daysInMonth }).map((_, i) => {
                  const date = `${month}-${pad(i + 1)}`;
                  const cents = calendar.byDay.get(date) ?? 0;
                  const intensity = cents > 0 ? cents / calendar.max : 0;
                  const isSelected = selectedDay === date;
                  return (
                    <button
                      key={date}
                      onClick={() =>
                        setSelectedDay(isSelected ? null : date)
                      }
                      className={`flex aspect-square flex-col items-center justify-center rounded-md text-[10px] ${
                        isSelected ? "ring-2 ring-neutral-900" : ""
                      }`}
                      style={{
                        backgroundColor:
                          cents > 0
                            ? `rgba(37, 99, 235, ${0.12 + intensity * 0.75})`
                            : cents < 0
                              ? "rgba(22, 163, 74, 0.25)"
                              : "#f5f5f5",
                        color: intensity > 0.55 ? "white" : "#404040",
                      }}
                    >
                      <span className="font-medium">{i + 1}</span>
                      {cents !== 0 && (
                        <span className="text-[8px] leading-tight">
                          {Math.abs(cents) >= 100000
                            ? `${(cents / 100000).toFixed(1)}k`
                            : Math.round(cents / 100)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedDay && (
                <div className="mt-3 border-t border-neutral-100 pt-3">
                  <p className="mb-2 text-xs font-semibold text-neutral-500">
                    {selectedDay} —{" "}
                    {usd(dayTxns.reduce((s, t) => s + t.amount_cents, 0))}
                  </p>
                  {dayTxns.map((t) => {
                    const b = cardBadge(t.cards?.name);
                    return (
                      <button
                        key={t.id}
                        onClick={() => setEditing(toEditable(t))}
                        className="flex w-full items-center justify-between gap-2 py-1 text-left text-xs active:bg-neutral-50"
                      >
                        <span className="truncate">{t.description}</span>
                        <span className="flex shrink-0 items-center gap-1.5">
                          <span
                            className={`rounded px-1 py-px text-[9px] font-medium ${b.className}`}
                          >
                            {b.short}
                          </span>
                          <span className="font-medium">
                            {usd(t.amount_cents)}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ---- month breakdown: tappable category chips + filtered list ---- */}
          {month && monthDetail && monthDetail.categories.length > 0 && (
            <section className="mb-8 rounded-2xl border border-neutral-200 bg-white p-4">
              <p className="mb-3 text-sm font-bold">
                {monthLabel(month)} breakdown
              </p>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {monthDetail.categories.map(([cat, v]) => (
                  <button
                    key={cat}
                    onClick={() =>
                      setSelectedCategory(selectedCategory === cat ? null : cat)
                    }
                    className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      selectedCategory === cat
                        ? "bg-neutral-900 text-white"
                        : "border border-neutral-200 bg-neutral-50 text-neutral-600"
                    }`}
                  >
                    {cat} · {usd(v.cents)}
                  </button>
                ))}
              </div>
              <p className="mb-2 text-xs text-neutral-400">
                {selectedCategory
                  ? `${selectedCategory} — ${monthDetail.list.length} transaction${monthDetail.list.length === 1 ? "" : "s"} (tap chip again to clear)`
                  : `All ${monthDetail.list.length} transactions — tap a category to filter`}
              </p>
              <div className="max-h-80 divide-y divide-neutral-100 overflow-y-auto">
                {monthDetail.list.map((t) => {
                  const b = cardBadge(t.cards?.name);
                  return (
                    <button
                      key={t.id}
                      onClick={() => setEditing(toEditable(t))}
                      className="flex w-full items-center justify-between gap-2 py-1.5 text-left text-xs active:bg-neutral-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate">{t.description}</p>
                        <p className="text-[10px] text-neutral-400">
                          {t.txn_date} ·{" "}
                          {t.categories?.name ?? "Uncategorized"}
                        </p>
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5">
                        <span
                          className={`rounded px-1 py-px text-[9px] font-medium ${b.className}`}
                        >
                          {b.short}
                        </span>
                        <span className="font-medium">
                          {usd(t.amount_cents)}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          {/* ---- categories over months ---- */}
          <section className="rounded-2xl border border-neutral-200 bg-white p-4">
            <p className="mb-1 text-sm font-bold">Categories by month</p>
            <p className="mb-3 text-xs text-neutral-400">
              Tap a month&apos;s bar to open it above
            </p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart.rows}
                  margin={{ left: -18, right: 4 }}
                  onClick={(state) => {
                    const idx = Number(state?.activeTooltipIndex ?? NaN);
                    const key = Number.isNaN(idx)
                      ? undefined
                      : (chart.rows[idx]?.key as string | undefined);
                    if (key) {
                      setMonth(key);
                      setSelectedDay(null);
                      setSelectedCategory(null);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                  style={{ cursor: "pointer" }}
                >
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip
                    formatter={(v, name) => [
                      `$${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                      String(name),
                    ]}
                    contentStyle={{ fontSize: 11 }}
                  />
                  {chart.categories.map((cat, i) => (
                    <Bar
                      key={cat}
                      dataKey={cat}
                      stackId="spend"
                      fill={CHART_COLORS[i % CHART_COLORS.length]}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
              {chart.categories.map((cat, i) => (
                <span
                  key={cat}
                  className="flex items-center gap-1 text-[10px] text-neutral-600"
                >
                  <span
                    className="inline-block h-2 w-2 rounded-sm"
                    style={{
                      backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                    }}
                  />
                  {cat}
                </span>
              ))}
            </div>
          </section>
        </>
      )}

      <EditTxnSheet
        txn={editing}
        onClose={() => setEditing(null)}
        onSaved={applySavedTag}
      />

      <Nav />
    </main>
  );
}
