# FINANCE OS

Personal spending tracker across all cards. Upload bank statements
(Chase PDF, Amex Excel, Chase CSV) → AI categorizes + splits business/personal
→ everything waits in a review queue until approved → calendar-month spending
views.

See `Project Overview.md` for full context and decisions.

## Setup

1. `npm install`
2. Create a Supabase project, run `scripts/schema.sql` in the SQL editor
3. Create the single auth user manually (Supabase dashboard → Auth → Add user)
4. Copy `.env.example` → `.env.local`, fill in values
5. `npm run dev`

## Commands

- `npm run dev` — dev server
- `npm run typecheck` — TypeScript check
- `npm run verify:parsers` — parse every file in `statements/` and reconcile
  against each statement's own totals (the parser regression test)

## Invariants (do not break)

- `amount_cents > 0` = money out; `< 0` = money in. Every parser normalizes.
- Monthly views use **transaction date**, calendar month. Statement periods
  are only for reconciliation.
- A statement that doesn't reconcile is rejected, never partially imported.
- Dedupe = occurrence-count matching on (card, date, amount, merchant) —
  see `lib/dedupe.ts`. Two real identical charges survive; re-uploads don't
  double.
- `statements/` contains real financial data and is gitignored. Keep it out
  of the repo.
