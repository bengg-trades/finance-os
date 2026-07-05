import { ParsedStatement } from "./types";
import { parseAmexXlsx } from "./amex-xlsx";
import { parseChasePdf } from "./chase-pdf";
import { parseChaseCsv } from "./chase-csv";

export * from "./types";

/**
 * Detect the statement format from the file itself and parse it.
 * xlsx → Amex export, pdf → Chase statement, csv → Chase activity export.
 */
export async function parseStatement(
  buffer: Buffer,
  filename: string
): Promise<ParsedStatement> {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  if (ext === "xlsx") return parseAmexXlsx(buffer);
  if (ext === "pdf") return parseChasePdf(buffer);
  if (ext === "csv") return parseChaseCsv(buffer.toString("utf8"), filename);
  throw new Error(
    `Unsupported statement file type ".${ext}" — expected .xlsx, .pdf, or .csv`
  );
}
