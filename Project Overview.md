# FINANCE OS — Project Overview

**Status:** LIVE in production (2026-07-04) — finance-os-sable.vercel.app. All 2026 statements imported + reviewed; Trends/drill-down shipped. Session history: daily `Task Update YYYY-MM-DD.md` files in this folder (read newest first).
**Type:** PERSONAL project — not tied to MOMENTUM or any brand.
**Accounts:** Supabase project goes in the same account as Trade Journal (`benggiles`). App is self-contained in this folder (Trade Journal pattern) — code + notes together, portable later.

## What it is

A private web app that tracks spending across all of Ben's cards. Statements (PDF/Excel) get uploaded each month, transactions are AI-categorized and split business vs. personal, and everything waits in a review queue until Ben approves it. Dashboards show cross-card totals, budgets, and trends — and the data is clean enough to hand to an accountant at tax time.

## Decisions locked in (from scoping interview)

| Decision | Choice |
|---|---|
| App type | Web app — Next.js + Supabase + Vercel (stack defaults) |
| Data ingest | Manual statement upload (PDF + Excel). No Plaid/bank sync. |
| Cards | 5+ cards across **Amex, Chase, Bank of America** |
| File formats | Mix of PDFs and Excel — parse Excel directly, AI extraction for PDFs with a totals-match verification step |
| Categorization | AI (Claude) suggests category + business/personal on import; learns from corrections |
| Review flow | **Everything** lands as pending — nothing is final until Ben approves. Bulk-approve with per-item tweaks. |
| Business/personal | Both visibility (filtered dashboards) **and** tax/accounting-ready (clean yearly CSV exports, strict category mapping) |
| History at launch | Back to **January 2026** (current calendar year) |
| Receipts | Phase 2 — data model designed for it now, built later |
| Users/access | Single user (Ben), login required. **Mobile-friendly UI is a hard requirement** — phone is a primary surface. |

## Core jobs (all must-haves)

1. **Categorized spending** — every transaction sorted (food, subscriptions, travel, software…)
2. **Cross-card totals** — one unified monthly view regardless of card
3. **Budgets & alerts** — per-category monthly limits, flagged when trending over
4. **Trends over time** — month-over-month charts, category growth, recurring-subscription detection
5. **Business vs. personal split** — tag on every transaction, separate views, tax-ready exports

## Build phases (proposed)

- **Phase 1 — Core tracker:** schema, statement upload + parsing (Excel direct, PDF via AI extraction with statement-total verification), AI categorization, review queue, unified transactions view.
- **Phase 2 — Insight:** dashboards (cross-card totals, trends), budgets & alerts, business/personal filtered views, yearly CSV export. Receipt attachments.
- **Phase 3 — Backfill:** import all statements back to Jan 2026, subscription detection.

## Statement inventory & formats (verified 2026-07-04)

Sample statements live in `FINANCE OS/statements/` (14 files, copied from ~/Downloads, double extensions normalized).

| Card | Bank | Format | Coverage | Parse status |
|---|---|---|---|---|
| Sapphire Preferred (…8673) | Chase | PDF (4 pages) | Jan–Jun 2026 | ✅ Text extracts cleanly; `MM/DD Description Amount` lines + ACCOUNT SUMMARY totals (verified May: purchases sum = $592.12 exactly) |
| Ink (…3295) | Chase | PDF | May–Jun 2026 only | ✅ Same layout as Sapphire — one Chase parser covers both |
| Business Gold (…41004) | Amex | Excel | Jan–Jun 2026 | ✅ Clean: "Transaction Details" sheet (headers row 7) incl. Amex's own Category column; "Transaction Summary" sheet has statement balance for reconciliation |

**Chase CSV option:** Chase also offers an Activity CSV export (`Transaction Date, Post Date, Description, Category, Type, Amount, Memo`) — a 2025 export for the Sapphire card exists in ~/Downloads. App will support Chase CSV as an input format too; CSVs are more reliable than PDFs when Ben remembers to export them.

**Statement coverage (confirmed 2026-07-04):**
- Chase Ink opened May 2026 — May–Jun is complete coverage, nothing missing
- Bank of America: no statements yet; BofA parser deferred until Ben sends files
- **Monthly views = calendar month (1st→end of month) by transaction date, always** — never statement period. Amex runs 27th→27th, Chase 24th→23rd / 16th→15th; statement dates are only used for reconciliation, never for reporting.

**Uploads are sporadic and WILL overlap — dedupe is a core feature, not an edge case.** Primary scenario (from Ben): upload activity for the 1st–27th, later upload the full month — the 1st–27th portion must not double-import; only the new tail (28th–end) comes in. Mechanism: per-transaction fingerprint (card + transaction date + amount + normalized merchant) with **occurrence-count matching**, not seen-before matching — two genuinely identical charges (e.g., 2× $14.99 Delta seat fees, same day — real, confirmed by Ben) both survive because the new file's count (2) matches the existing count (2), so zero import. Statement-level hash additionally skips byte-identical re-uploads. Every import shows a summary: N imported, M skipped as already-present.

**Sign conventions differ by source (critical for parser):** Amex xlsx: positive = charge. Chase PDF: positive = charge, negative = payment/credit. Chase CSV: negative = charge ("Sale"), positive = payment. Normalize everything on import.

## Key risks / notes

- **PDF parsing is the hard part.** Each bank formats statements differently; AI extraction must be verified against the statement's own totals before anything imports. A statement that doesn't reconcile gets flagged, never silently imported.
- **Financial data = sensitive.** RLS on every table, service-role key server-side only, auth required even though single-user.
- **Duplicate protection:** re-uploading the same statement must not double-import transactions (hash/dedupe on statement + transaction fingerprint).
- Excel exports from banks vary too (Amex vs. Chase column layouts) — one parser per bank format.

## Locations

- **Vault notes:** this folder (`DEVELOPER/FINANCE OS/`)
- **Code repo:** not created yet — will live at `~/Desktop/finance-os` (outside the vault, per convention)
- **Live URL / GitHub / env vars:** TBD once build starts

## Next step

Ben sends sample statements (at least one PDF and one Excel per bank — Amex, Chase, BofA). Parsers get built against real files, not guesses.
