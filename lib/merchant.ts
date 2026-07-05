// Merchant-name normalization used for dedupe fingerprints and merchant rules.
// Must be deterministic and stable across statement formats: the same charge
// appearing in a Chase PDF and a Chase CSV must normalize identically.

export function normalizeMerchant(description: string): string {
  return description
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

/**
 * Dedupe fingerprint for one transaction (occurrence index handled
 * separately): same card + same day + same amount + same merchant.
 */
export function fingerprint(
  cardId: string,
  dateIso: string,
  amountCents: number,
  description: string
): string {
  return [cardId, dateIso, amountCents, normalizeMerchant(description)].join(
    "|"
  );
}
