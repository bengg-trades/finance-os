// Chase Activity CSV export.
// Header: Transaction Date,Post Date,Description,Category,Type,Amount,Memo
// Signs as exported: charges NEGATIVE ("Sale"), payments/returns POSITIVE —
// the opposite of our convention, so amounts are flipped on import.
//
// CSVs carry no statement totals, so reconciliation is not possible for this
// format; dedupe + the review queue are the safety net.

import {
  ParsedStatement,
  ParsedTransaction,
  TxnType,
  toCents,
} from "./types";

/** Minimal RFC-4180 line splitter (quoted fields may contain commas). */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

function usDateToIso(us: string): string | null {
  const m = us.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
}

const TYPE_MAP: Record<string, TxnType> = {
  Sale: "purchase",
  Payment: "payment",
  Return: "refund",
  Fee: "fee",
  Adjustment: "refund",
};

export function parseChaseCsv(
  content: string,
  filename?: string
): ParsedStatement {
  const lines = content.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) throw new Error("Chase CSV: empty file");

  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  const idx = (name: string) => header.indexOf(name);
  for (const required of ["Transaction Date", "Description", "Amount"]) {
    if (idx(required) === -1)
      throw new Error(`Chase CSV: missing "${required}" column`);
  }

  // Chase filenames embed the card: e.g. Chase8673_Activity20250101_...
  const last4 = filename?.match(/Chase(\d{4})_/i)?.[1] ?? "";

  const transactions: ParsedTransaction[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const dateIso = usDateToIso(cells[idx("Transaction Date")] ?? "");
    const amountRaw = Number((cells[idx("Amount")] ?? "").replace(/[$,]/g, ""));
    if (!dateIso || isNaN(amountRaw)) continue;
    const description = (cells[idx("Description")] ?? "")
      .replace(/\s+/g, " ")
      .trim();
    const chaseType = (cells[idx("Type")] ?? "").trim();
    const bankCategory = (cells[idx("Category")] ?? "").trim() || undefined;
    // Flip sign: Chase CSV charges are negative; ours are positive (money out)
    const amountCents = -toCents(amountRaw);
    transactions.push({
      date: dateIso,
      description,
      amountCents,
      type:
        TYPE_MAP[chaseType] ?? (amountCents < 0 ? "refund" : "purchase"),
      bankCategory,
    });
  }

  return {
    format: "chase-csv",
    cardLast4: last4,
    transactions,
    reconciliation: {
      checked: false,
      ok: true,
      details: [
        "Chase CSV carries no statement totals — dedupe + review queue are the safety net",
      ],
    },
  };
}
