// POST /api/categorize — (re)run AI categorization for pending purchases
// that have no category yet. Used when an import ran without the API key,
// or after adding new categories. Merchant rules win over AI, same as import.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scopeKey } from "@/lib/categories";
import { ensureCategories } from "@/lib/seedCategories";
import { fetchApprovedExamples } from "@/lib/examples";
import { categorizeTransactions, TxnToCategorize } from "@/lib/categorize";

export const maxDuration = 300;

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  // Any uncategorized purchase, pending OR approved — this also heals rows
  // after a taxonomy migration. Status is never changed here.
  const { data: uncategorized } = await supabase
    .from("transactions")
    .select(
      "id, description, amount_cents, merchant_norm, bank_category, cards(name, default_use)"
    )
    .eq("txn_type", "purchase")
    .is("category_id", null)
    .limit(500);

  if (!uncategorized || uncategorized.length === 0) {
    return NextResponse.json({ status: "ok", categorized: 0, from_rules: 0 });
  }

  const catMap = await ensureCategories(supabase, user.id);
  const { data: rules } = await supabase
    .from("merchant_rules")
    .select("merchant_norm, category_id, spend_type");
  const ruleMap = new Map((rules ?? []).map((r) => [r.merchant_norm, r]));

  let fromRules = 0;
  const needAi: TxnToCategorize[] = [];
  for (const t of uncategorized) {
    const card = t.cards as unknown as {
      name: string;
      default_use: "personal" | "business";
    } | null;
    const rule = ruleMap.get(t.merchant_norm);
    if (rule) {
      await supabase
        .from("transactions")
        .update({
          category_id: rule.category_id,
          spend_type: rule.spend_type,
          ai_confidence: 1,
        })
        .eq("id", t.id);
      fromRules++;
    } else {
      needAi.push({
        id: t.id,
        description: t.description,
        amountUsd: (t.amount_cents / 100).toFixed(2),
        cardName: card?.name ?? "unknown card",
        cardDefaultUse: card?.default_use ?? "personal",
        bankCategory: t.bank_category ?? undefined,
      });
    }
  }

  let aiCount = 0;
  if (needAi.length > 0) {
    const examples = await fetchApprovedExamples(supabase);
    const suggestions = await categorizeTransactions(needAi, examples);
    for (const s of suggestions) {
      const categoryId = catMap.get(scopeKey(s.spend_type, s.category));
      if (!categoryId) continue;
      await supabase
        .from("transactions")
        .update({
          category_id: categoryId,
          spend_type: s.spend_type,
          ai_confidence: s.confidence,
        })
        .eq("id", s.id);
      aiCount++;
    }
  }

  return NextResponse.json({
    status: "ok",
    categorized: aiCount,
    from_rules: fromRules,
  });
}
