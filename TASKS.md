# FINANCE OS — Task Log

Session-to-session continuity. Read this first when picking up work.

## 2026-07-04 — Phase 1 build

**Done:**
- Scoping interview complete → decisions in Project Overview.md
- 14 sample statements collected into `statements/` (Chase Sapphire Jan–Jun PDF,
  Chase Ink May–Jun PDF, Amex Business Gold Jan–Jun xlsx)
- App scaffolded (Next 15 / React 19 / TS / Tailwind, mirrors Trade Journal)
- Parsers built + verified: **all 14 files reconcile to the penny**
  (`npm run verify:parsers`). Chase CSV parser tested against real 2025 export.
- `scripts/schema.sql` written (RLS everywhere, occurrence-count dedupe index)
- Import pipeline: `/api/import` — hash dedupe → parse → reconcile-or-reject →
  occurrence dedupe → pending insert → merchant-rules then Claude categorization
- UI: login (magic link), spending view (calendar month), upload w/ receipt,
  review queue w/ bulk approve + rule learning

**Also done (same day, later session):**
- Supabase project live: `tubohrkfexrqlhpxfeqr` (bengg org), schema installed,
  `.env.local` wired, login working (password auth added after magic-link
  rate-limit pain; auth/confirm now handles both PKCE code + token_hash)
- Review queue rebuilt as **drag-and-drop board**: Personal | Business columns,
  AI pre-places, drag to flip, per-card category select, Approve All learns rules
- Git repo initialized, pushed to github.com/bengg-trades/finance-os (main).
  statements/ + .env.local verified gitignored before first commit.

**Blocked on Ben:**
- ANTHROPIC_API_KEY → paste into `.env.local` (uncomment the line) + Vercel env
- Vercel: import the GitHub repo + set 3 env vars (instructions given)
- After first deploy: Supabase Auth → URL Configuration → set Site URL to the
  vercel.app domain + add `https://<domain>/auth/confirm` to Redirect URLs
- BofA statements (whenever — parser deferred until files exist)

**Next up:**
- End-to-end test: import all 14 statements, verify board flow + dedupe
- Phase 2: budgets & alerts, trends charts, tax-year CSV export, receipts
