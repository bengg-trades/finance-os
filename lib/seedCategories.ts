import type { SupabaseClient } from "@supabase/supabase-js";
import { CATEGORY_TAXONOMY, scopeKey } from "./categories";

/**
 * Ensure the scoped taxonomy exists for this user and return a lookup map
 * keyed "scope:name" → category id. Used by both import and categorize.
 */
export async function ensureCategories(
  supabase: SupabaseClient,
  userId: string
): Promise<Map<string, string>> {
  const { data: existing } = await supabase
    .from("categories")
    .select("id, name, scope");
  const map = new Map<string, string>(
    (existing ?? []).map((c) => [scopeKey(c.scope, c.name), c.id])
  );

  const missing: { user_id: string; name: string; scope: string }[] = [];
  for (const scope of ["business", "personal"] as const) {
    for (const name of CATEGORY_TAXONOMY[scope]) {
      if (!map.has(scopeKey(scope, name))) {
        missing.push({ user_id: userId, name, scope });
      }
    }
  }
  if (missing.length > 0) {
    const { data: seeded } = await supabase
      .from("categories")
      .insert(missing)
      .select("id, name, scope");
    for (const c of seeded ?? []) map.set(scopeKey(c.scope, c.name), c.id);
  }
  return map;
}
