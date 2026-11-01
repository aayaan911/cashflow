-- Cashflow core schema (2026-11-01). Run once in the Supabase SQL editor of project `cashflow`.
-- Money is stored as integer minor units (paisa / cents): amount_minor, never a float.
-- Every table: owner_id defaults to the signed-in user, RLS on, one owner policy, deleted_at soft delete.

create extension if not exists pgcrypto;

-- ───────────── accounts ─────────────
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind text not null default 'bank' check (kind in ('bank', 'mobile', 'cash', 'usd', 'other')),
  currency text not null default 'BDT' check (currency in ('BDT', 'USD')),
  opening_minor bigint not null default 0,
  sort int not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ───────────── categories ─────────────
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  icon text not null default 'tag',
  hue int,
  budget_minor bigint not null default 0,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ───────────── transactions (income + expenses) ─────────────
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind text not null check (kind in ('income', 'expense')),
  occurred_on date not null,
  name text not null,
  note text,
  -- amount in the account's own currency (USD cents on a USD account)
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'BDT' check (currency in ('BDT', 'USD')),
  -- taka value for every total; equals amount_minor on a BDT account
  amount_bdt_minor bigint not null check (amount_bdt_minor > 0),
  fx_rate numeric(12, 4),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  source text,
  recurring_id uuid,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists transactions_owner_date on public.transactions (owner_id, occurred_on desc) where deleted_at is null;

-- ───────────── transfers between accounts ─────────────
create table if not exists public.transfers (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  occurred_on date not null,
  from_account_id uuid references public.accounts (id) on delete set null,
  to_account_id uuid references public.accounts (id) on delete set null,
  sent_minor bigint not null check (sent_minor > 0),
  sent_currency text not null default 'BDT' check (sent_currency in ('BDT', 'USD')),
  received_minor bigint not null check (received_minor > 0),
  received_currency text not null default 'BDT' check (received_currency in ('BDT', 'USD')),
  fee_minor bigint not null default 0,
  rate numeric(12, 4),
  note text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists transfers_owner_date on public.transfers (owner_id, occurred_on desc) where deleted_at is null;

-- ───────────── budgets (a month's limit per category; categories.budget_minor is the default) ─────────────
create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  month date not null,
  limit_minor bigint not null default 0,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (owner_id, category_id, month)
);

-- ───────────── recurring bills and income ─────────────
create table if not exists public.recurring (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('income', 'expense')),
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null default 'BDT' check (currency in ('BDT', 'USD')),
  category_id uuid references public.categories (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  every text not null default 'month' check (every in ('week', 'month', 'year')),
  next_on date not null,
  active boolean not null default true,
  estimate boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ───────────── debts: money lent or borrowed, out of income and spending ─────────────
create table if not exists public.debts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  person text not null,
  direction text not null check (direction in ('lent', 'borrowed')),
  total_minor bigint not null check (total_minor > 0),
  started_on date not null,
  account_id uuid references public.accounts (id) on delete set null,
  note text,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.debt_payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  debt_id uuid not null references public.debts (id) on delete cascade,
  paid_on date not null,
  amount_minor bigint not null check (amount_minor > 0),
  account_id uuid references public.accounts (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ───────────── savings goals ─────────────
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  target_minor bigint not null check (target_minor > 0),
  due_on date,
  account_id uuid references public.accounts (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table if not exists public.savings_deposits (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_id uuid not null references public.savings_goals (id) on delete cascade,
  deposited_on date not null,
  amount_minor bigint not null check (amount_minor <> 0),
  source text,
  note text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- ───────────── RLS: owner only, on every table ─────────────
do $$
declare t text;
begin
  foreach t in array array['accounts','categories','transactions','transfers','budgets','recurring','debts','debt_payments','savings_goals','savings_deposits'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists owner_all on public.%I', t);
    execute format('create policy owner_all on public.%I for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id)', t);
  end loop;
end $$;
