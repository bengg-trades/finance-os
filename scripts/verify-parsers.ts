// Parse every sample statement in statements/ and check that parsed totals
// reconcile against each statement's own printed summary.
// Run: npm run verify:parsers

import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { parseStatement, centsToUsd } from "../lib/parsers";

const DIR = join(__dirname, "..", "statements");

async function main() {
  const files = readdirSync(DIR)
    .filter((f) => /\.(pdf|xlsx|csv)$/i.test(f))
    .sort();

  let failures = 0;
  for (const file of files) {
    const buffer = readFileSync(join(DIR, file));
    try {
      const stmt = await parseStatement(buffer, file);
      const spendCents = stmt.transactions
        .filter((t) => t.type === "purchase" || t.type === "fee" || t.type === "interest")
        .reduce((s, t) => s + t.amountCents, 0);
      const status = !stmt.reconciliation.checked
        ? "UNCHECKED"
        : stmt.reconciliation.ok
          ? "OK"
          : "FAIL";
      if (status === "FAIL") failures++;
      console.log(
        `${status.padEnd(9)} ${file}  [${stmt.format}, card …${stmt.cardLast4}, ${stmt.periodStart ?? "?"}→${stmt.periodEnd ?? "?"}]  ${stmt.transactions.length} txns, spend ${centsToUsd(spendCents)}`
      );
      for (const d of stmt.reconciliation.details) console.log(`          ${d}`);
    } catch (err) {
      failures++;
      console.log(`ERROR     ${file}: ${(err as Error).message}`);
    }
  }

  console.log(failures === 0 ? "\nAll statements reconcile." : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
