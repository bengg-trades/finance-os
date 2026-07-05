// Chase credit-card statement PDF (Sapphire Preferred, Ink — same layout).
//
// Transaction lines look like:  "05/12     FOUNDATION VITAMINS & SPO SHELTON CT 225.24"
// Signs as printed: purchases/fees positive, payments/credits negative —
// which already matches our normalized convention (positive = money out).
//
// Every parse is reconciled against the statement's own ACCOUNT SUMMARY
// (Purchases / Payment, Credits / Fees Charged / Interest Charged). A parse
// that doesn't reconcile must never be silently imported.

// pdf-parse's index.js runs a debug self-test when imported as a top-level
// module; importing the lib entry directly avoids it.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import {
  ParsedStatement,
  ParsedTransaction,
  TxnType,
  toCents,
  centsToUsd,
} from "./types";

function parseMoney(s: string): number {
  return Number(s.replace(/[$,]/g, ""));
}

/** "26" -> 2026 */
function fullYear(yy: string): number {
  return 2000 + Number(yy);
}

function classify(description: string, amountCents: number): TxnType {
  const d = description.toUpperCase();
  if (/PAYMENT THANK YOU|AUTOMATIC PAYMENT/.test(d)) return "payment";
  if (/MEMBERSHIP FEE|LATE FEE|RETURN(ED)? CHECK FEE|CASH ADVANCE FEE|BALANCE TRANSFER FEE|FOREIGN TRANSACTION/.test(d))
    return "fee";
  if (/INTEREST CHARGE/.test(d)) return "interest";
  return amountCents < 0 ? "refund" : "purchase";
}

export async function parseChasePdf(buffer: Buffer): Promise<ParsedStatement> {
  const { text } = await pdfParse(buffer);

  const acct = text.match(/Account Number:\s*X{4} X{4} X{4} (\d{4})/i);
  const cardLast4 = acct ? acct[1] : "";

  // pdf-parse often emits no space between a label and its value
  // ("Opening/Closing Date04/24/26 - 05/23/26"), so separators are optional.
  const period = text.match(
    /Opening\/Closing Date\s*(\d{2})\/(\d{2})\/(\d{2})\s*-\s*(\d{2})\/(\d{2})\/(\d{2})/
  );
  if (!period) throw new Error("Chase PDF: Opening/Closing Date not found");
  const openY = fullYear(period[3]);
  const closeY = fullYear(period[6]);
  const periodStart = `${openY}-${period[1]}-${period[2]}`;
  const periodEnd = `${closeY}-${period[4]}-${period[5]}`;
  const openMonth = Number(period[1]);

  // A transaction's printed date has no year. Pick the year so the date lands
  // inside the statement period (handles Dec→Jan statements).
  function txnDateIso(mm: string, dd: string): string {
    let year = closeY;
    if (openY !== closeY && Number(mm) >= openMonth) year = openY;
    return `${year}-${mm}-${dd}`;
  }

  const summary: Record<string, number | null> = {
    purchases: null,
    credits: null,
    fees: null,
    interest: null,
  };
  const grab = (re: RegExp) => {
    const m = text.match(re);
    return m ? parseMoney(m[1]) : null;
  };
  summary.purchases = grab(/Purchases\s*\+?(-?\$[\d,]+\.\d{2})/);
  summary.credits = grab(/Payment, Credits\s*(-?\$[\d,]+\.\d{2})/);
  summary.fees = grab(/Fees Charged\s*\+?(-?\$[\d,]+\.\d{2})/);
  summary.interest = grab(/Interest Charged\s*\+?(-?\$[\d,]+\.\d{2})/);

  // One transaction per line: MM/DD <description><amount at end of line>.
  // No space before the amount — pdf-parse glues it to the description
  // ("05/03     SUNOCO 8000401602 MONROE CT87.00").
  const lineRe = /^(\d{2})\/(\d{2})\s+(.+?)(-?[\d,]+\.\d{2})\s*$/gm;
  const transactions: ParsedTransaction[] = [];
  for (const m of text.matchAll(lineRe)) {
    const [, mm, dd, desc, amt] = m;
    const description = desc.replace(/\s+/g, " ").trim();
    const amountCents = toCents(parseMoney(amt));
    transactions.push({
      date: txnDateIso(mm, dd),
      description,
      amountCents,
      type: classify(description, amountCents),
    });
  }

  // Reconcile every bucket against the ACCOUNT SUMMARY.
  const sum = (type: TxnType) =>
    transactions.filter((t) => t.type === type).reduce((s, t) => s + t.amountCents, 0);

  const reconciliation = { checked: true, ok: true, details: [] as string[] };
  const check = (label: string, parsedCents: number, stmt: number | null) => {
    if (stmt === null) {
      reconciliation.details.push(`${label}: statement total not found`);
      reconciliation.ok = false;
      return;
    }
    const stmtCents = toCents(stmt);
    const ok = parsedCents === stmtCents;
    reconciliation.ok &&= ok;
    reconciliation.details.push(
      `${label}: parsed ${centsToUsd(parsedCents)} ${ok ? "==" : "!="} statement ${centsToUsd(stmtCents)}`
    );
  };

  check("purchases", sum("purchase"), summary.purchases);
  check("payments/credits", sum("payment") + sum("refund"), summary.credits);
  check("fees", sum("fee"), summary.fees);
  check("interest", sum("interest"), summary.interest);

  return {
    format: "chase-pdf",
    cardLast4,
    periodStart,
    periodEnd,
    transactions,
    reconciliation,
  };
}
