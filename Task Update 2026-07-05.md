# Task Update 2026-07-05

## Retag transactions from anywhere

**Shipped:**
- **`components/EditTxnSheet.tsx`** — shared bottom-sheet editor. Tap any
  transaction → sheet slides up → flip personal/business (same-name categories
  remap across sides, e.g. Travel → Travel), re-pick category (side-scoped
  list), save. Works on pending AND approved transactions.
- **Learning on correction:** saving a retag upserts the merchant rule, so a
  fix teaches future imports exactly like a review-board approval does.
- **Wired everywhere transactions appear:**
  - Spending page list (extracted to `components/TxnList.tsx`, client) —
    totals/category groupings refresh after save
  - Trends → month breakdown rows
  - Trends → calendar day-detail rows
  (Review board already had inline editing.)
- Non-purchase rows (payments/refunds) can still be moved between
  personal/business in the sheet, just without a category.

**Notes:**
- Retagging changes only the tapped transaction + the merchant's future rule.
  It does NOT bulk-update other past transactions from the same merchant —
  candidate future feature ("apply to all 12 from this merchant?").

**Next up (unchanged):** budgets & alerts, tax-year CSV export, receipts,
BofA parser when statements arrive.
