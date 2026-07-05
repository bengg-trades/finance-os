# FINANCE OS — Task Log

Session-to-session continuity. Read this first when picking up work.

## 2026-07-04 — Phase 1 built, deployed, and in daily use (full day)

**Shipped today, in order:**
1. **Scoping interview** → all decisions in `Project Overview.md`
2. **Parsers** (Chase PDF, Amex xlsx, Chase CSV) — all 14 sample statements
   reconcile to the penny; regression check: `npm run verify:parsers`
3. **Schema** (`scripts/schema.sql`) — RLS everywhere, occurrence-count dedupe
4. **Import pipeline** (`/api/import`) — hash dedupe → parse → reconcile-or-reject
   → pending insert → categorization (rules first, Claude for the rest)
5. **App UI** — password + magic-link login, calendar-month Spending view, Upload
   with import receipts
6. **Supabase live**: project `tubohrkfexrqlhpxfeqr` (bengg org). Auth fixed twice:
   confirm route now handles PKCE `code` + `token_hash`; password login added
   after free-tier email rate limits (~2/hr) made magic links painful
7. **GitHub + Vercel**: repo `bengg-trades/finance-os`, live at
   **finance-os-sable.vercel.app** ("sable" = name collision, cosmetic).
   Env vars in Vercel; deploy = push to main. First deploy 500'd until rebuild
   baked the env vars in (remember: env changes need a fresh build, no cache)
8. **Review board** (replaces list): drag-and-drop Personal | Business columns,
   AI pre-places, per-card category select, Approve All learns merchant rules.
   Payments excluded from column totals + badged "not spending"
9. **Scoped taxonomy** (interview-locked): business (Software, Trading Tools &
   Data, Education & Community, Travel, Equipment, Supplies, Business Meals,
   Fees & Interest, Other) / personal (Grocery, Housing, Dining, Clothing,
   Travel, Car, Health & Fitness, Entertainment, Gifts & Family, Fees &
   Interest, Other). Migration run in prod
   (`scripts/migrations/2026-07-04-scoped-categories.sql`). Board dropdowns are
   side-scoped; dragging remaps same-name categories
10. **Card badges** — colored chips (Sapphire/Ink/Gold) on board, spending list,
    trends
11. **Few-shot learning** — categorizer prompt now includes up to 40 of Ben's
    own approved decisions (deduped by merchant); improves with every session
12. **Trends page** — calendar heatmap (tap day → detail), categories-by-month
    stacked chart, All/Business/Personal filter, click a month bar → month
    breakdown with tappable category chips filtering the transaction list

**State at shutdown:**
- All 2026 statements (Jan–Jun: Sapphire, Ink, Amex Gold) imported and reviewed
- Merchant rules populated from Ben's manual categorization pass
- App live on phone + desktop via Vercel

**Next up (Phase 2 remainder):**
- Budgets & alerts (per-category monthly limits, trending-over warnings)
- Tax-year CSV export (business transactions per year, accountant-ready)
- Receipts attachments (schema already has `receipt_url`)
- BofA parser — when Ben sends statements
- Nice-to-haves parked: custom domain, local-model categorizer (revisit only if
  cost/privacy becomes a concern — merchant rules cover most volume soon)

**Gotchas for future sessions:**
- Statement files live in `statements/` — gitignored, NEVER commit
- `.env.local` has Supabase + Anthropic keys — gitignored, NEVER commit
- Monthly views = calendar month by txn_date; statement periods only reconcile
- Signs: amount_cents > 0 = money out; Chase CSV arrives inverted (parser flips)
- Categories are side-scoped — always look up by (scope, name), see
  `lib/categories.ts` + `ensureCategories()`
