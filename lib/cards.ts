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
