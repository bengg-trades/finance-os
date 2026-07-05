import { ParsedTransaction } from "./parsers/types";
import { normalizeMerchant } from "./merchant";

export interface TxnWithOccurrence extends ParsedTransaction {
  merchantNorm: string;
  occurrence: number;
}

/**
 * Assign occurrence indices within one parsed file: the Nth transaction in
 * the file with the same (date, amount, merchant) gets occurrence N. Combined
 * with the DB unique index on (card, date, amount, merchant, occurrence),
 * this makes imports idempotent while preserving genuinely identical charges
 * (two same-day $14.99 Delta seat fees = occurrences 1 and 2).
 */
export function assignOccurrences(
  txns: ParsedTransaction[]
): TxnWithOccurrence[] {
  const counts = new Map<string, number>();
  return txns.map((t) => {
    const merchantNorm = normalizeMerchant(t.description);
    const key = `${t.date}|${t.amountCents}|${merchantNorm}`;
    const occurrence = (counts.get(key) ?? 0) + 1;
    counts.set(key, occurrence);
    return { ...t, merchantNorm, occurrence };
  });
}
