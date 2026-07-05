// Two-sided category taxonomy (locked in with Ben, 2026-07-04).
// Every category belongs to a side; the sort board only offers the
// column's own list. "Travel", "Fees & Interest", and "Other" exist on
// both sides — they're distinct categories that share a name.

export type CategoryScope = "business" | "personal";

export const CATEGORY_TAXONOMY: Record<CategoryScope, string[]> = {
  business: [
    "Software",
    "Trading Tools & Data",
    "Education & Community",
    "Travel",
    "Equipment",
    "Supplies",
    "Business Meals",
    "Fees & Interest",
    "Other",
  ],
  personal: [
    "Grocery",
    "Housing",
    "Dining",
    "Clothing",
    "Travel",
    "Car",
    "Health & Fitness",
    "Entertainment",
    "Gifts & Family",
    "Fees & Interest",
    "Other",
  ],
};

/** All category names, deduped — used for the AI output schema enum */
export const ALL_CATEGORY_NAMES = [
  ...new Set([...CATEGORY_TAXONOMY.business, ...CATEGORY_TAXONOMY.personal]),
];

export function scopeKey(scope: string, name: string): string {
  return `${scope}:${name}`;
}
