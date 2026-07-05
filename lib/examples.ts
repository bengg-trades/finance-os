import type { SupabaseClient } from "@supabase/supabase-js";
import type { ApprovedExample } from "./categorize";

/**
 * Recent approved purchases, deduped by merchant — the owner's own past
 * decisions, fed to the categorizer as few-shot examples so it learns
 * their style for merchants it hasn't seen.
 */
export async function fetchApprovedExamples(
  supabase: SupabaseClient,
  cap = 40
): Promise<ApprovedExample[]> {
  const { data } = await supabase
    .from("transactions")
    .select("description, spend_type, merchant_norm, categories(name)")
    .eq("status", "approved")
    .eq("txn_type", "purchase")
    .not("category_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(150);

  const seen = new Set<string>();
  const examples: ApprovedExample[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.merchant_norm)) continue;
    const category = (row.categories as unknown as { name: string } | null)
      ?.name;
    if (!category || !row.spend_type) continue;
    seen.add(row.merchant_norm);
    examples.push({
      description: row.description,
      category,
      spend_type: row.spend_type as "personal" | "business",
    });
    if (examples.length >= cap) break;
  }
  return examples;
}
