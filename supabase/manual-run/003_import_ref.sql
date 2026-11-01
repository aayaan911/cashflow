-- Import reference (2026-11-02). Run once in the Supabase SQL editor of project `cashflow`.
-- Rows brought in from another tool (Notion first) carry the source row's id, so re-running an import
-- skips what is already there instead of doubling it. Null for everything entered in the app.

alter table public.transactions add column if not exists import_ref text;
alter table public.transfers add column if not exists import_ref text;
alter table public.savings_deposits add column if not exists import_ref text;

create unique index if not exists transactions_import_ref on public.transactions (owner_id, import_ref) where import_ref is not null;
create unique index if not exists transfers_import_ref on public.transfers (owner_id, import_ref) where import_ref is not null;
create unique index if not exists savings_deposits_import_ref on public.savings_deposits (owner_id, import_ref) where import_ref is not null;
