// Known cards, keyed by the last-4 printed on statements.
// Unknown cards are auto-created on import with a generic name; rename in DB.

export interface KnownCard {
  name: string;
  bank: "chase" | "amex" | "bofa";
  defaultUse: "personal" | "business";
}

export const KNOWN_CARDS: Record<string, KnownCard> = {
  "8673": { name: "Chase Sapphire Preferred", bank: "chase", defaultUse: "personal" },
  "3295": { name: "Chase Ink", bank: "chase", defaultUse: "business" },
  "1004": { name: "Amex Business Gold", bank: "amex", defaultUse: "business" },
};

// ---- display badges (client-safe) ----

export interface CardBadge {
  short: string;
  className: string; // tailwind chip classes
}

const BADGES: Record<string, CardBadge> = {
  "Chase Sapphire Preferred": {
    short: "Sapphire",
    className: "bg-blue-100 text-blue-700",
  },
  "Chase Ink": { short: "Ink", className: "bg-emerald-100 text-emerald-700" },
  "Amex Business Gold": {
    short: "Gold",
    className: "bg-amber-100 text-amber-700",
  },
};

const FALLBACK_PALETTE = [
  "bg-purple-100 text-purple-700",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-lime-100 text-lime-700",
];

export function cardBadge(name: string | null | undefined): CardBadge {
  if (!name) return { short: "?", className: "bg-neutral-100 text-neutral-500" };
  if (BADGES[name]) return BADGES[name];
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return {
    short: name.split(" ").pop() ?? name,
    className: FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length],
  };
}
