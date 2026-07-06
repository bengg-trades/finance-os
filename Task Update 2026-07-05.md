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

## Branding + money loader (later same day)

- **Logo** (`components/Logo.tsx`): dark tile, ascending green bars, gold $
  coin. Same artwork serves as favicon (`app/icon.svg`) and iOS home-screen
  icon (`app/apple-icon.tsx`, PNG generated at build via next/og). Shown on
  the login page.
- **MoneyLoader** (`components/MoneyLoader.tsx`): flipping gold coin
  (CSS keyframes in globals.css). Used in: route-level `app/loading.tsx`,
  Trends ("Crunching the numbers…"), Review board ("Dealing the cards…"),
  Upload while importing.

## Logo + loader v2 (later same day)

Ben reviewed 4 logo directions + 4 loader animations (live artifact gallery)
and picked the recommended pair:

- **Logo "Gold cap"** — dark green tile (#101b14), three ascending emerald
  bars, gold cap on the tallest (the old cartoon coin absorbed into the
  chart). Updated in `components/Logo.tsx`, `app/icon.svg`,
  `app/apple-icon.tsx` (rendered PNG verified visually).
- **Loader "Rising bars"** — the logo's three bars breathing in a staggered
  rise (gold-capped third bar), replacing the coin flip. `MoneyLoader.tsx`
  markup + new `bar-rise` keyframes in `globals.css`; respects
  prefers-reduced-motion. Same props, so all four usage sites unchanged.
- Palette now consistent everywhere: greens #2f9e63/#3cc878/#52e695,
  gold #f2b52a. `npm run build` passes. NOT yet deployed — Ben to confirm.

**Next up (unchanged):** budgets & alerts, tax-year CSV export, receipts,
BofA parser when statements arrive.
