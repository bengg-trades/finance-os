// POST /api/import — upload one statement file (xlsx/pdf/csv).
//
// Pipeline: parse → reconcile against the statement's own totals →
// dedupe (occurrence-count matching) → insert as pending → AI categorize.
// A statement that doesn't reconcile is rejected, never silently imported.
//
// Runs under the logged-in user's session (RLS enforced) — no service key.

import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseStatement } from "@/lib/parsers";
import { assignOccurrences } from "@/lib/dedupe";
import { KNOWN_CARDS } from "@/lib/cards";
import { scopeKey } from "@/lib/categories";
import { ensureCategories } from "@/lib/seedCategories";
import { categorizeTransactions, TxnToCategorize } from "@/lib/categorize";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  // Byte-identical re-upload → skip immediately
  const { data: existing } = await supabase
    .from("statements")
    .select("id, filename, imported_count, skipped_count")
    .eq("file_sha256", sha256)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({
      status: "duplicate_file",
      message: `This exact file was already imported as "${existing.filename}" (${existing.imported_count} transactions).`,
    });
  }

  // Parse + reconcile
  let stmt;
  try {
    stmt = await parseStatement(buffer, file.name);
  } catch (err) {
    return NextResponse.json(
      { error: `Could not parse statement: ${(err as Error).message}` },
      { status: 400 }
    );
  }
  if (stmt.reconciliation.checked && !stmt.reconciliation.ok) {
    return NextResponse.json(
      {
        error:
          "Statement did not reconcile — parsed totals don't match the statement's own summary. Nothing was imported.",
        details: stmt.reconciliation.details,
      },
      { status: 422 }
    );
  }
  if (stmt.transactions.length === 0) {
    return NextResponse.json(
      { error: "No transactions found in this file." },
      { status: 400 }
    );
  }

  // Find or create the card
  const known = KNOWN_CARDS[stmt.cardLast4];
  const bank = known?.bank ?? (stmt.format === "amex-xlsx" ? "amex" : "chase");
  let { data: card } = await supabase
    .from("cards")
    .select("id, name, default_use")
    .eq("bank", bank)
    .eq("last4", stmt.cardLast4)
    .maybeSingle();
  if (!card) {
    const { data: created, error: cardErr } = await supabase
      .from("cards")
      .insert({
        user_id: user.id,
        name: known?.name ?? `${bank.toUpperCase()} …${stmt.cardLast4}`,
        bank,
        last4: stmt.cardLast4,
        default_use: known?.defaultUse ?? "personal",
      })
      .select("id, name, default_use")
      .single();
    if (cardErr) {
      return NextResponse.json({ error: cardErr.message }, { status: 500 });
    }
    card = created;
  }

  // Seed the scoped taxonomy on first use; map is keyed "scope:name"
  const catMap = await ensureCategories(supabase, user.id);

  // Record the statement
  const { data: statementRow, error: stmtErr } = await supabase
    .from("statements")
    .insert({
      user_id: user.id,
      card_id: card.id,
      filename: file.name,
      file_sha256: sha256,
      format: stmt.format,
      period_start: stmt.periodStart ?? null,
      period_end: stmt.periodEnd ?? null,
      reconciliation_ok: stmt.reconciliation.ok,
      reconciliation_details: stmt.reconciliation.details,
    })
    .select("id")
    .single();
  if (stmtErr) {
    return NextResponse.json({ error: stmtErr.message }, { status: 500 });
  }

  // Dedupe insert: occurrence-count matching + unique index. ignoreDuplicates
  // means overlapping transactions from earlier imports are skipped, not doubled.
  const withOcc = assignOccurrences(stmt.transactions);
  // Card fees follow the card's side (Ink annual fee = business fee)
  const feesCatId =
    catMap.get(scopeKey(card.default_use, "Fees & Interest")) ?? null;
  const rows = withOcc.map((t) => ({
    user_id: user.id,
    card_id: card.id,
    statement_id: statementRow.id,
    txn_date: t.date,
    description: t.description,
    merchant_norm: t.merchantNorm,
    amount_cents: t.amountCents,
    txn_type: t.type,
    occurrence: t.occurrence,
    status: "pending",
    bank_category: t.bankCategory ?? null,
    spend_type: card.default_use,
    category_id: t.type === "fee" || t.type === "interest" ? feesCatId : null,
  }));

  const { data: inserted, error: insertErr } = await supabase
    .from("transactions")
    .upsert(rows, {
      onConflict: "card_id,txn_date,amount_cents,merchant_norm,occurrence",
      ignoreDuplicates: true,
    })
    .select("id, description, amount_cents, merchant_norm, txn_type");
  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }
  const importedCount = inserted?.length ?? 0;
  const skippedCount = rows.length - importedCount;

  // Categorize newly imported purchases: learned merchant rules first, AI for the rest
  const purchases = (inserted ?? []).filter((t) => t.txn_type === "purchase");
  let ruleHits = 0;
  let aiCategorized = 0;

  if (purchases.length > 0) {
    const { data: rules } = await supabase
      .from("merchant_rules")
      .select("merchant_norm, category_id, spend_type");
    const ruleMap = new Map((rules ?? []).map((r) => [r.merchant_norm, r]));

    const needAi: TxnToCategorize[] = [];
    for (const t of purchases) {
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
        ruleHits++;
      } else {
        const src = withOcc.find(
          (w) =>
            w.merchantNorm === t.merchant_norm &&
            w.amountCents === t.amount_cents
        );
        needAi.push({
          id: t.id,
          description: t.description,
          amountUsd: (t.amount_cents / 100).toFixed(2),
          cardName: card.name,
          cardDefaultUse: card.default_use,
          bankCategory: src?.bankCategory,
        });
      }
    }

    if (needAi.length > 0 && process.env.ANTHROPIC_API_KEY) {
      try {
        const suggestions = await categorizeTransactions(needAi);
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
          aiCategorized++;
        }
      } catch {
        // AI categorization is best-effort — uncategorized rows just wait in review
      }
    }
  }

  await supabase
    .from("statements")
    .update({ imported_count: importedCount, skipped_count: skippedCount })
    .eq("id", statementRow.id);

  return NextResponse.json({
    status: "ok",
    card: card.name,
    period: stmt.periodStart
      ? `${stmt.periodStart} → ${stmt.periodEnd}`
      : "n/a",
    reconciliation: stmt.reconciliation,
    imported: importedCount,
    skipped_as_already_present: skippedCount,
    categorized_by_rules: ruleHits,
    categorized_by_ai: aiCategorized,
  });
}
