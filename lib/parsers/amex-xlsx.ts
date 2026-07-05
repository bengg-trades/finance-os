import ExcelJS from "exceljs";
import {
  ParsedStatement,
  ParsedTransaction,
  TxnType,
  toCents,
  centsToUsd,
} from "./types";

// Amex "Transaction Details" xlsx export.
// Sheet 1 "Transaction Details": banner rows, then a header row starting with
// "Date", then one row per transaction. Amounts: positive = charge.
// Sheet 2 "Transaction Summary": SUMMARY block whose "Charges" /
// "Payments & Credits" / "Statement Balance" rows we reconcile against.

function cellText(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (v instanceof Date) {
    const mm = String(v.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(v.getUTCDate()).padStart(2, "0");
    return `${mm}/${dd}/${v.getUTCFullYear()}`;
  }
  if (typeof v === "object") {
    if ("richText" in v) return v.richText.map((r) => r.text).join("");
    if ("text" in v) return String(v.text);
    if ("result" in v) return String(v.result ?? "");
    return String(v);
  }
  return String(v);
}

function cellNumber(v: ExcelJS.CellValue): number | null {
  if (typeof v === "number") return v;
  const s = cellText(v).replace(/[$,]/g, "").trim();
  if (s === "" || isNaN(Number(s))) return null;
  return Number(s);
}

function usDateToIso(us: string): string | null {
  const m = us.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[1]}-${m[2]}`;
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function classify(description: string, amountCents: number): TxnType {
  const d = description.toUpperCase();
  if (amountCents < 0) {
    return /PAYMENT|AUTOPAY/.test(d) ? "payment" : "refund";
  }
  if (/MEMBERSHIP FEE|LATE FEE|ANNUAL FEE/.test(d)) return "fee";
  if (/INTEREST CHARGE/.test(d)) return "interest";
  return "purchase";
}

export async function parseAmexXlsx(buffer: Buffer): Promise<ParsedStatement> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);

  const details = wb.getWorksheet("Transaction Details") ?? wb.worksheets[0];
  if (!details) throw new Error("Amex xlsx: no worksheet found");

  let cardLast4 = "";
  let periodStart: string | undefined;
  let periodEnd: string | undefined;
  let headerRow = -1;
  const colIdx: Record<string, number> = {};

  details.eachRow((row, rowNumber) => {
    if (headerRow !== -1) return;
    const first = cellText(row.getCell(1).value).trim();

    const acct = first.match(/X{4}-X{6}-\d?(\d{4})$/);
    if (acct) cardLast4 = acct[1];

    // Banner cell like "Business Gold Card / Apr 27, 2026 to May 27, 2026"
    for (let c = 1; c <= 2; c++) {
      const t = cellText(row.getCell(c).value);
      const p = t.match(
        /([A-Z][a-z]{2}) (\d{1,2}), (\d{4}) to ([A-Z][a-z]{2}) (\d{1,2}), (\d{4})/
      );
      if (p) {
        periodStart = `${p[3]}-${MONTHS[p[1]]}-${p[2].padStart(2, "0")}`;
        periodEnd = `${p[6]}-${MONTHS[p[4]]}-${p[5].padStart(2, "0")}`;
      }
    }

    if (first === "Date") {
      headerRow = rowNumber;
      row.eachCell((cell, col) => {
        colIdx[cellText(cell.value).trim()] = col;
      });
    }
  });

  if (headerRow === -1) throw new Error("Amex xlsx: header row not found");
  for (const required of ["Date", "Description", "Amount"]) {
    if (!colIdx[required])
      throw new Error(`Amex xlsx: missing "${required}" column`);
  }

  const transactions: ParsedTransaction[] = [];
  details.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const dateIso = usDateToIso(cellText(row.getCell(colIdx["Date"]).value));
    const amount = cellNumber(row.getCell(colIdx["Amount"]).value);
    if (!dateIso || amount === null) return;
    const description = cellText(row.getCell(colIdx["Description"]).value)
      .replace(/\s+/g, " ")
      .trim();
    const amountCents = toCents(amount);
    transactions.push({
      date: dateIso,
      description,
      amountCents,
      type: classify(description, amountCents),
      bankCategory: colIdx["Category"]
        ? cellText(row.getCell(colIdx["Category"]).value).trim() || undefined
        : undefined,
    });
  });

  // Reconcile against the Transaction Summary sheet.
  const details2 = wb.getWorksheet("Transaction Summary");
  const reconciliation = {
    checked: false,
    ok: true,
    details: [] as string[],
  };
  if (details2) {
    let chargesTotal: number | null = null;
    let creditsTotal: number | null = null;
    details2.eachRow((row) => {
      const label = cellText(row.getCell(1).value).trim();
      // Total is the last column of the SUMMARY block (D)
      const total = cellNumber(row.getCell(4).value);
      if (label === "Charges" && total !== null) chargesTotal = total;
      if (label === "Payments & Credits" && total !== null)
        creditsTotal = total;
    });

    if (chargesTotal !== null) {
      reconciliation.checked = true;
      const parsedCharges = transactions
        .filter((t) => t.amountCents > 0)
        .reduce((s, t) => s + t.amountCents, 0);
      const stmtCharges = toCents(chargesTotal);
      const chargesOk = parsedCharges === stmtCharges;
      reconciliation.ok &&= chargesOk;
      reconciliation.details.push(
        `charges: parsed ${centsToUsd(parsedCharges)} ${chargesOk ? "==" : "!="} statement ${centsToUsd(stmtCharges)}`
      );

      if (creditsTotal !== null) {
        // Amex reports Payments & Credits as a positive magnitude
        const parsedCredits = -transactions
          .filter((t) => t.amountCents < 0)
          .reduce((s, t) => s + t.amountCents, 0);
        const stmtCredits = Math.abs(toCents(creditsTotal));
        const creditsOk = parsedCredits === stmtCredits;
        reconciliation.ok &&= creditsOk;
        reconciliation.details.push(
          `payments/credits: parsed ${centsToUsd(parsedCredits)} ${creditsOk ? "==" : "!="} statement ${centsToUsd(stmtCredits)}`
        );
      }
    }
  }
  if (!reconciliation.checked) {
    reconciliation.details.push(
      "no Transaction Summary sheet — totals not verified"
    );
  }

  return {
    format: "amex-xlsx",
    cardLast4,
    periodStart,
    periodEnd,
    transactions,
    reconciliation,
  };
}
