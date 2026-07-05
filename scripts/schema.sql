-- FINANCE OS — Supabase schema (source of truth)
-- Run in the Supabase SQL editor on first setup.
--
-- Conventions:
--   amount_cents > 0 = money OUT (purchase/fee/interest)
--   amount_cents < 0 = money IN  (payment/refund)
--   Every table has RLS on; policies restrict rows to their owner.
--   All app queries (including /api/import) run under the logged-in user's
--   session — the service-role key is not used anywhere in Phase 1.

-- ============================== cards ==============================
create table cards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id),
  name        text not null,                    -- "Chase Sapphire Preferred"
  bank        text not null,                    -- 'chase' | 'amex' | 'bofa'
  last4       text not null,
  -- what this card is *usually* for; the AI uses it as a prior
  default_use text not null default 'personal'
              check (default_use in ('personal', 'business')),
  created_at  timestamptz not null default now(),
  unique (user_id, bank, last4)
);

-- =========================== categories ============================
create table categories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id),
  name       text not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- =========================== statements ============================
-- One row per uploaded file. file_sha256 blocks byte-identical re-uploads.
create table statements (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references auth.users (id),
  card_id                uuid references cards (id),
  filename               text not null,
  file_sha256            text not null,
  format                 text not null
                         check (format in ('amex-xlsx', 'chase-pdf', 'chase-csv')),
  period_start           date,
  period_end             date,
  reconciliation_ok      boolean not null,
  reconciliation_details jsonb not null default '[]',
  imported_count         integer not null default 0,
  skipped_count          integer not null default 0,
  created_at             timestamptz not null default now(),
  unique (user_id, file_sha256)
);

-- ========================== transactions ===========================
create table transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id),
  card_id       uuid not null references cards (id),
  statement_id  uuid references statements (id),
  txn_date      date not null,                  -- transaction date, never post date
  description   text not null,
  merchant_norm text not null,                  -- normalized merchant (dedupe + rules)
  amount_cents  bigint not null,
  txn_type      text not null
                check (txn_type in ('purchase', 'payment', 'refund', 'fee', 'interest')),
  -- Nth identical (card, date, amount, merchant) charge in the same period.
  -- Two real same-day identical charges get occurrence 1 and 2; re-importing
  -- an overlapping statement collides on the unique index and is skipped.
  occurrence    integer not null default 1,
  status        text not null default 'pending'
                check (status in ('pending', 'approved')),
  category_id   uuid references categories (id),
  spend_type    text check (spend_type in ('personal', 'business')),
  ai_confidence real,                           -- 0..1 from the categorizer
  bank_category text,                           -- category the bank itself assigned
  receipt_url   text,                           -- Phase 2: attached receipt
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- The dedupe backbone: occurrence-count matching.
create unique index transactions_dedupe
  on transactions (card_id, txn_date, amount_cents, merchant_norm, occurrence);

create index transactions_by_month on transactions (user_id, txn_date);
create index transactions_pending on transactions (user_id, status)
  where status = 'pending';

-- ========================= merchant_rules ==========================
-- Learned from approvals: next import of the same merchant skips the AI.
create table merchant_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id),
  merchant_norm text not null,
  category_id   uuid references categories (id),
  spend_type    text check (spend_type in ('personal', 'business')),
  hit_count     integer not null default 1,
  updated_at    timestamptz not null default now(),
  unique (user_id, merchant_norm)
);

-- ============================ budgets ==============================
-- Phase 2 feature; table exists now so it's config, not a migration.
create table budgets (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users (id),
  category_id         uuid not null references categories (id),
  spend_type          text check (spend_type in ('personal', 'business')),
  monthly_limit_cents bigint not null,
  created_at          timestamptz not null default now(),
  unique (user_id, category_id, spend_type)
);

-- ============================== RLS ================================
alter table cards          enable row level security;
alter table categories     enable row level security;
alter table statements     enable row level security;
alter table transactions   enable row level security;
alter table merchant_rules enable row level security;
alter table budgets        enable row level security;

create policy "own cards"          on cards          for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own categories"     on categories     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own statements"     on statements     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own transactions"   on transactions   for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own merchant_rules" on merchant_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own budgets"        on budgets        for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at maintenance
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger transactions_updated_at
  before update on transactions
  for each row execute function set_updated_at();
