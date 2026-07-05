// Fixed category taxonomy, seeded per-user on first import.
// Keep this list stable — the categorizer prompt and budgets reference it.

export const DEFAULT_CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Travel",
  "Transport",
  "Software & Subscriptions",
  "Trading Tools",
  "Business Services",
  "Shopping",
  "Health & Fitness",
  "Entertainment",
  "Home",
  "Fees & Interest",
  "Other",
] as const;

export type CategoryName = (typeof DEFAULT_CATEGORIES)[number];
