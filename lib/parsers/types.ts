// Common shapes all statement parsers produce.
//
// Sign convention (normalized across every bank/format):
//   amountCents > 0  = money OUT (purchase, fee, interest)
//   amountCents < 0  = money IN  (payment, refund/credit)

export type TxnType = "purchase" | "payment" | "refund" | "fee" | "interest";

export type BankFormat = "amex-xlsx" | "chase-pdf" | "chase-csv";

export interface ParsedTransaction {
  /** ISO date (YYYY-MM-DD) — the transaction date, never the post date */
  date: string;
  description: string;
  amountCents: number;
  type: TxnType;
  /** Category the bank itself assigned, when the format provides one */
  bankCategory?: string;
}

export interface Reconciliation {
  /** false when the format carries no self-reported totals (Chase CSV) */
  checked: boolean;
  ok: boolean;
  /** One line per check, e.g. "purchases: parsed $592.12 == statement $592.12" */
  details: string[];
}

export interface ParsedStatement {
  format: BankFormat;
  /** Last digits of the card number as printed on the statement */
  cardLast4: string;
  /** Statement period, ISO dates, when the format provides one */
  periodStart?: string;
  periodEnd?: string;
  transactions: ParsedTransaction[];
  reconciliation: Reconciliation;
}

export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

export function centsToUsd(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}
