#!/usr/bin/env python3
"""Turn the Notion Finance 25 / 26 exports (JSON files) into one SQL file for the Supabase SQL editor.

Rules: never invent a row. A row with no amount, no date and no month is skipped and listed. Money is
integer minor units. Every inserted row carries its Notion page URL, so running the SQL twice adds nothing.

Usage: python3 scripts/notion-import-gen.py <dir with the json files> <out.sql> <report.md>
"""
import json, re, sys, calendar, os

SRC, OUT_SQL, OUT_MD = sys.argv[1], sys.argv[2], sys.argv[3]

def load(name):
    p = os.path.join(SRC, name)
    return json.load(open(p)) if os.path.exists(p) else []

def strip_emoji(s):
    s = re.sub(r"[\U0001F300-\U0001FAFF☀-➿️]", "", s or "")
    return re.sub(r"\s+", " ", s).strip()

def clean_name(s):
    s = re.sub(r"</?(p|b|span[^>]*)>", "", s or "")
    s = s.replace("\\$", "$")
    return re.sub(r"\s+", " ", s).strip()

def q(s):
    return "NULL" if s is None else "'" + str(s).replace("'", "''") + "'"

def minor(x):
    return int(round(float(x) * 100))

MONTHS = {m: i for i, m in enumerate(["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"], 1)}

def month_end(year, mon):
    m = MONTHS.get(mon)
    if not m:
        return None
    return f"{year}-{m:02d}-{calendar.monthrange(year, m)[1]:02d}"

# ── accounts ──────────────────────────────────────────────────────────────────
ACCOUNTS = [
    ("DBBL", "bank", "BDT", "building"), ("UCB", "bank", "BDT", "building"),
    ("bKash", "mobile", "BDT", "zap"), ("Nagad", "mobile", "BDT", "zap"), ("Cash", "cash", "BDT", "banknote"),
    ("Payoneer", "usd", "USD", "globe"), ("Payoneer V2", "usd", "USD", "globe"),
    ("Fiverr", "usd", "USD", "laptop"), ("Wise", "usd", "USD", "globe"), ("Crypto", "usd", "USD", "circle"),
]
# Income type -> account, only where Ayaan's own notes say where the money lands.
INCOME_ACCOUNT = {"AED Leader": "Payoneer V2", "Fiverr": "Payoneer", "Peter": "Wise"}
EXP_ICON = {"Investment": "briefcase", "Business": "briefcase", "Bird": "circle", "Bike": "bike", "Monthly Cost": "zap",
            "Family": "home", "Snacks & Meal": "coffee", "Shopping": "shopping-bag", "Debt": "users",
            "Friends / Hangout": "users", "Cigar": "tag", "Transport": "car", "Tour": "plane", "Charity": "gift",
            "Tools / Software": "wrench", "Waste of Money": "tag", "Unexpected Cost": "tag",
            "Health + Style + Fitness": "heart", "Debt I Paid Back": "users", "Yearly": "tag", "Networking": "users",
            "Asset": "building", "Ramadan": "gift"}
INC_ICON = {"Fiverr": "laptop", "AED Leader": "briefcase", "Peter": "globe", "Outside": "globe", "Mediya.nl": "globe",
            "Local": "banknote", "EAK Digital": "laptop", "Upwork": "laptop", "Debt Back": "users", "Sell / Sold": "tag",
            "Bird": "circle", "Salami": "gift", "Salle Color": "tag", "Debt I took": "users", "Software": "wrench"}

skipped = []      # (table, year, name, reason)
assumed = []      # (table, year, name, assumption)
tx_rows = []      # dicts
tr_rows = []
cats = {}         # (name, kind) -> icon

def add_cat(name, kind):
    icon = (EXP_ICON if kind == "expense" else INC_ICON).get(name, "tag")
    cats[(name, kind)] = icon

# ── expenses ─────────────────────────────────────────────────────────────────
for year, fname in ((2025, "expenses-2025.json"), (2026, "expenses-2026.json")):
    for r in load(fname):
        name = clean_name(r.get("name"))
        typ = strip_emoji(r.get("type")) or None
        bdt = r.get("bdt")
        d = r.get("d")
        note = clean_name(r.get("note")) or None
        if bdt is None or float(bdt) <= 0:
            if name or typ:
                skipped.append(("expense", year, name or "(no name)", "no amount" if bdt is None else "amount is 0"))
            continue
        if not d:
            d = month_end(year, r.get("month"))
            if not d:
                skipped.append(("expense", year, name, "no date and no month"))
                continue
            assumed.append(("expense", year, name, f"no date in Notion, dated {d} (last day of its month)"))
        if not typ:
            typ = "Uncategorised"
            assumed.append(("expense", year, name, "no type in Notion, category Uncategorised"))
        add_cat(typ, "expense")
        tx_rows.append(dict(url=r["url"], kind="expense", d=d, name=name or typ, note=note, amount=minor(bdt),
                            currency="BDT", bdt=minor(bdt), fx=None, cat=typ, acct=None, source=None))

# ── income ───────────────────────────────────────────────────────────────────
for year, fname in ((2025, "income-2025.json"), (2026, "income-2026.json")):
    for r in load(fname):
        name = clean_name(r.get("name"))
        typ = strip_emoji(r.get("type")) or None
        bdt, usd, d = r.get("bdt"), r.get("usd"), r.get("d")
        note = clean_name(r.get("note")) or None
        url = r.get("url")
        if bdt is None and usd is None:
            if name:
                skipped.append(("income", year, name, "no amount (a note row)"))
            continue
        if not d:
            if name == "Return 5K from Sishir Bhai":
                skipped.append(("income", year, name, "no date; the same 5,000 is dated 2025-07-05 already"))
                continue
            d = month_end(year, r.get("month"))
            if not d:
                skipped.append(("income", year, name, "no date and no month"))
                continue
            assumed.append(("income", year, name, f"no date in Notion, dated {d} (last day of its month)"))
        if not typ:
            typ = "Uncategorised"
            assumed.append(("income", year, name, "no type in Notion, category Uncategorised"))
        add_cat(typ, "income")
        # The 2025 income file carries no page url; a stable key built from the row keeps the re-run safe.
        url = url or f"notion-income-{year}:{d}:{name}:{bdt}:{usd}"
        acct = INCOME_ACCOUNT.get(typ)
        if acct and usd:
            if bdt is None:
                rate = 115.0
                bdt = float(usd) * rate
                assumed.append(("income", year, name, f"no taka amount in Notion; ${usd} at 115 (the rate written on the rows around it)"))
            tx_rows.append(dict(url=url, kind="income", d=d, name=name, note=note, amount=minor(usd), currency="USD",
                                bdt=minor(bdt), fx=round(float(bdt) / float(usd), 4), cat=typ, acct=acct, source=typ))
        else:
            if bdt is None:
                skipped.append(("income", year, name, f"only a dollar amount (${usd}) and no account to hold dollars"))
                continue
            if acct:
                assumed.append(("income", year, name, f"no dollar amount, so booked in taka with no account"))
            tx_rows.append(dict(url=url, kind="income", d=d, name=name, note=note, amount=minor(bdt), currency="BDT",
                                bdt=minor(bdt), fx=None, cat=typ, acct=None, source=typ))

# ── withdraws -> transfers ───────────────────────────────────────────────────
for year, fname in ((2025, "withdraws-2025.json"), (2026, "withdraws-2026.json")):
    for r in load(fname):
        name = clean_name(r.get("reason"))
        frm = (r.get("from") or "").strip()
        bdt, usd, d = r.get("bdt"), r.get("usd"), r.get("d")
        note = clean_name(r.get("note")) or None
        # The 2025 withdraws file carries no page url; a stable key built from the row keeps the re-run safe.
        url = r.get("url") or f"notion-withdraw-{year}:{d}:{name}:{bdt}:{usd}"
        if bdt is None and usd is None:
            if name:
                skipped.append(("transfer", year, name, "no amount"))
            continue
        if not d:
            skipped.append(("transfer", year, name, "no date"))
            continue
        src = dst = None
        sent = recv = None
        scur = rcur = "BDT"
        rate = None
        if frm in ("Payoneer To Bank", "Payoneer V2 To Bank") or (frm == "" and usd and bdt):
            src = "Payoneer V2" if frm == "Payoneer V2 To Bank" else ("Payoneer" if frm else "Payoneer V2")
            dst = "UCB" if note and "UCB" in note else "DBBL"
            if frm == "":
                assumed.append(("transfer", year, name, "no From in Notion; dollars and taka both given, so Payoneer V2 to DBBL"))
            if not usd or not bdt:
                skipped.append(("transfer", year, name, "Payoneer withdrawal missing the dollar or the taka side"))
                continue
            sent, scur, recv, rcur, rate = minor(usd), "USD", minor(bdt), "BDT", round(float(bdt) / float(usd), 4)
        elif frm == "DBBL to Cash" or (frm == "" and name.strip().upper() == "DBBL"):
            src, dst, sent, recv = "DBBL", "Cash", minor(bdt), minor(bdt)
            if frm == "":
                assumed.append(("transfer", year, name, "no From in Notion; reason says DBBL, so DBBL to Cash"))
        elif frm == "UCB to Cash":
            src, dst, sent, recv = "UCB", "Cash", minor(bdt), minor(bdt)
        elif frm == "Bkash to Cash":
            src, dst, sent, recv = "bKash", "Cash", minor(bdt), minor(bdt)
        elif frm == "Bank to Bkash":
            src, dst, sent, recv = "DBBL", "bKash", minor(bdt), minor(bdt)
        elif frm == "Nagad":
            src, dst, sent, recv = "Nagad", "Cash", minor(bdt), minor(bdt)
        elif frm == "Crypto":
            if not usd or not bdt:
                skipped.append(("transfer", year, name, "crypto cash-out missing a side"))
                continue
            src, dst, sent, scur, recv, rcur, rate = "Crypto", "Cash", minor(usd), "USD", minor(bdt), "BDT", round(float(bdt) / float(usd), 4)
        elif frm == "Fiverr to Payoneer":
            if usd:
                src, dst, sent, scur, recv, rcur = "Fiverr", "Payoneer", minor(usd), "USD", minor(usd), "USD"
            else:
                skipped.append(("transfer", year, name, f"Fiverr to Payoneer with no dollar amount (taka column says {bdt})"))
                continue
        elif frm == "Payoneer CARD":
            skipped.append(("transfer", year, name, "card spend, already in Expenses (Notion for 12 months)"))
            continue
        elif frm == "Bkash":
            skipped.append(("transfer", year, name, "a bKash payment, not a move between your accounts"))
            continue
        else:
            skipped.append(("transfer", year, name, f"no From in Notion ({'dollar amount only' if bdt is None else 'taka only'})" if frm == "" else f"From '{frm}' not mapped"))
            continue
        tr_rows.append(dict(url=url, d=d, src=src, dst=dst, sent=sent, scur=scur, recv=recv, rcur=rcur, rate=rate,
                            note=(name + (" · " + note if note else "")) or None))

# ── SQL ──────────────────────────────────────────────────────────────────────
L = []
L.append("""-- Notion Finance 25 + 26 import for Cashflow. Generated by scripts/notion-import-gen.py.
-- Run once in the Supabase SQL editor of project cashflow (znqxbjukyrhzxeqlfcrg). Safe to run twice: every
-- row carries its Notion page URL and is inserted only when that URL is not in the table yet.
-- Owner: the ONE confirmed user of this project. The block stops if there is none or more than one.

alter table public.transactions add column if not exists notion_url text;
alter table public.transfers add column if not exists notion_url text;
create index if not exists transactions_notion_url on public.transactions (owner_id, notion_url) where notion_url is not null;
create index if not exists transfers_notion_url on public.transfers (owner_id, notion_url) where notion_url is not null;

do $$
declare
  v_owner uuid;
  v_email text;
  n_acc int := 0; n_cat int := 0; n_tx int := 0; n_tr int := 0;
begin
  select count(*) into n_acc from auth.users where email_confirmed_at is not null;
  if n_acc <> 1 then
    raise exception 'Expected exactly one confirmed user, found %. Confirm your own account first.', n_acc;
  end if;
  select id, email into v_owner, v_email from auth.users where email_confirmed_at is not null;
  raise notice 'Importing for %', v_email;

  create temp table imp_acc (name text, kind text, currency text, icon text) on commit drop;
  create temp table imp_cat (name text, kind text, icon text) on commit drop;
  create temp table imp_tx (notion_url text, kind text, occurred_on date, name text, note text, amount_minor bigint,
    currency text, amount_bdt_minor bigint, fx_rate numeric, cat text, acct text, source text) on commit drop;
  create temp table imp_tr (notion_url text, occurred_on date, src text, dst text, sent_minor bigint, sent_currency text,
    received_minor bigint, received_currency text, rate numeric, note text) on commit drop;
""")
for i, (n, k, c, ic) in enumerate(ACCOUNTS):
    L.append(f"  insert into imp_acc values ({q(n)}, {q(k)}, {q(c)}, {q(ic)});")
for (n, k), ic in sorted(cats.items()):
    L.append(f"  insert into imp_cat values ({q(n)}, {q(k)}, {q(ic)});")
for t in tx_rows:
    L.append("  insert into imp_tx values (" + ", ".join([q(t['url']), q(t['kind']), q(t['d']), q(t['name']), q(t['note']),
             str(t['amount']), q(t['currency']), str(t['bdt']), "NULL" if t['fx'] is None else str(t['fx']), q(t['cat']),
             q(t['acct']), q(t['source'])]) + ");")
for t in tr_rows:
    L.append("  insert into imp_tr values (" + ", ".join([q(t['url']), q(t['d']), q(t['src']), q(t['dst']), str(t['sent']),
             q(t['scur']), str(t['recv']), q(t['rcur']), "NULL" if t['rate'] is None else str(t['rate']), q(t['note'])]) + ");")
L.append("""
  -- accounts and categories: only the ones not there yet (matched by name and kind)
  insert into public.accounts (owner_id, name, kind, currency, opening_minor, sort)
  select v_owner, a.name, a.kind, a.currency, 0, row_number() over ()
  from imp_acc a where not exists (select 1 from public.accounts x where x.owner_id = v_owner and x.name = a.name and x.deleted_at is null);
  get diagnostics n_acc = row_count;

  insert into public.categories (owner_id, name, kind, icon, sort)
  select v_owner, c.name, c.kind, c.icon, row_number() over ()
  from imp_cat c where not exists (select 1 from public.categories x where x.owner_id = v_owner and x.name = c.name and x.kind = c.kind and x.deleted_at is null);
  get diagnostics n_cat = row_count;

  insert into public.transactions (owner_id, kind, occurred_on, name, note, amount_minor, currency, amount_bdt_minor, fx_rate, category_id, account_id, source, notion_url)
  select v_owner, t.kind, t.occurred_on, t.name, t.note, t.amount_minor, t.currency, t.amount_bdt_minor, t.fx_rate,
    (select id from public.categories c where c.owner_id = v_owner and c.name = t.cat and c.kind = t.kind and c.deleted_at is null limit 1),
    (select id from public.accounts a where a.owner_id = v_owner and a.name = t.acct and a.deleted_at is null limit 1),
    t.source, t.notion_url
  from imp_tx t where not exists (select 1 from public.transactions x where x.owner_id = v_owner and x.notion_url = t.notion_url);
  get diagnostics n_tx = row_count;

  insert into public.transfers (owner_id, occurred_on, from_account_id, to_account_id, sent_minor, sent_currency, received_minor, received_currency, fee_minor, rate, note, notion_url)
  select v_owner, t.occurred_on,
    (select id from public.accounts a where a.owner_id = v_owner and a.name = t.src and a.deleted_at is null limit 1),
    (select id from public.accounts a where a.owner_id = v_owner and a.name = t.dst and a.deleted_at is null limit 1),
    t.sent_minor, t.sent_currency, t.received_minor, t.received_currency, 0, t.rate, t.note, t.notion_url
  from imp_tr t where not exists (select 1 from public.transfers x where x.owner_id = v_owner and x.notion_url = t.notion_url);
  get diagnostics n_tr = row_count;

  raise notice 'Added % accounts, % categories, % transactions, % transfers', n_acc, n_cat, n_tx, n_tr;
end $$;

-- Check after running: the four counts should match the report.
select 'transactions' as t, count(*) from public.transactions where notion_url is not null and deleted_at is null
union all select 'transfers', count(*) from public.transfers where notion_url is not null and deleted_at is null
union all select 'income taka', sum(amount_bdt_minor) / 100 from public.transactions where kind = 'income' and notion_url is not null and deleted_at is null
union all select 'expense taka', sum(amount_bdt_minor) / 100 from public.transactions where kind = 'expense' and notion_url is not null and deleted_at is null;
""")
open(OUT_SQL, "w").write("\n".join(L))

# ── report ───────────────────────────────────────────────────────────────────
def tk(n): return "৳" + f"{n/100:,.0f}"
inc = [t for t in tx_rows if t["kind"] == "income"]; exp = [t for t in tx_rows if t["kind"] == "expense"]
by_year = lambda rows, y: [t for t in rows if t["d"].startswith(str(y))]
R = ["# Notion import into Cashflow (generated)", "",
     f"SQL: `supabase/manual-run/002_notion_import_2025_2026.sql`. Generated from the Notion exports in the session scratchpad by `scripts/notion-import-gen.py`.", "",
     "## What goes in", "", "| Table | 2025 | 2026 | Total |", "|---|---|---|---|",
     f"| Income rows | {len(by_year(inc,2025))} ({tk(sum(t['bdt'] for t in by_year(inc,2025)))}) | {len(by_year(inc,2026))} ({tk(sum(t['bdt'] for t in by_year(inc,2026)))}) | {len(inc)} |",
     f"| Expense rows | {len(by_year(exp,2025))} ({tk(sum(t['bdt'] for t in by_year(exp,2025)))}) | {len(by_year(exp,2026))} ({tk(sum(t['bdt'] for t in by_year(exp,2026)))}) | {len(exp)} |",
     f"| Transfers | {len([t for t in tr_rows if t['d'].startswith('2025')])} | {len([t for t in tr_rows if t['d'].startswith('2026')])} | {len(tr_rows)} |",
     f"| Accounts | | | {len(ACCOUNTS)} (opening balance 0, set the real ones on Accounts) |",
     f"| Categories | | | {len(cats)} ({len([1 for k in cats if k[1]=='expense'])} expense, {len([1 for k in cats if k[1]=='income'])} income), Notion's names without the emoji |",
     "", "Income is booked on an account only where Notion's own notes say where it lands: AED Leader on Payoneer V2, Fiverr on Payoneer, Peter on Wise (in dollars, with the taka value and rate from the row). Every other income row and every expense row has no account: Notion never recorded which wallet paid. Savings (6 rows, 2025) are not imported: the Cashflow Savings page needs a goal with a target, and Notion has none.",
     "", f"## Rows skipped ({len(skipped)})", "", "| Table | Year | Row | Why |", "|---|---|---|---|"]
R += [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in skipped]
R += ["", f"## Assumptions made ({len(assumed)})", "", "| Table | Year | Row | Assumption |", "|---|---|---|---|"]
R += [f"| {a} | {b} | {c} | {d} |" for a, b, c, d in assumed]
open(OUT_MD, "w").write("\n".join(R) + "\n")
print(f"tx={len(tx_rows)} (income {len(inc)}, expense {len(exp)}) transfers={len(tr_rows)} cats={len(cats)} skipped={len(skipped)} assumed={len(assumed)}")
