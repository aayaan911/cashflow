# Notion import into Cashflow (generated)

SQL: `supabase/manual-run/002_notion_import_2025_2026.sql`. Generated from the Notion exports in the session scratchpad by `scripts/notion-import-gen.py`.

## What goes in

| Table | 2025 | 2026 | Total |
|---|---|---|---|
| Income rows | 52 (৳2,463,281) | 2 (৳11,700) | 54 |
| Expense rows | 672 (৳2,481,108) | 27 (৳165,940) | 699 |
| Transfers | 58 | 3 | 61 |
| Accounts | | | 10 (opening balance 0, set the real ones on Accounts) |
| Categories | | | 31 (22 expense, 9 income), Notion's names without the emoji |

Income is booked on an account only where Notion's own notes say where it lands: AED Leader on Payoneer V2, Fiverr on Payoneer, Peter on Wise (in dollars, with the taka value and rate from the row). Every other income row and every expense row has no account: Notion never recorded which wallet paid. Savings (6 rows, 2025) are not imported: the Cashflow Savings page needs a goal with a target, and Notion has none.

## Rows skipped (9)

| Table | Year | Row | Why |
|---|---|---|---|
| expense | 2025 | 31st Cost | amount is 0 |
| expense | 2025 | Bike → Mamla for Over Speed (From Dhaka Bank) 🟡 - 5K | no amount |
| income | 2025 | Debt | no amount (a note row) |
| income | 2025 | November Cash Calculation | no amount (a note row) |
| income | 2025 | Return 5K from Sishir Bhai | no date; the same 5,000 is dated 2025-07-05 already |
| transfer | 2025 | Fiverr v1 | no From in Notion (dollar amount only) |
| transfer | 2025 | For Notion | card spend, already in Expenses (Notion for 12 months) |
| transfer | 2025 | Hosting for Blenzix | a bKash payment, not a move between your accounts |
| transfer | 2025 | From Fiverr V1 | Fiverr to Payoneer with no dollar amount (taka column says 75) |

## Assumptions made (5)

| Table | Year | Row | Assumption |
|---|---|---|---|
| income | 2025 | Fiverr v1 | no taka amount in Notion; $461 at 115 (the rate written on the rows around it) |
| income | 2025 | NonRing BIrd Sell 9x + Breeding 1 Pair | no date in Notion, dated 2025-04-30 (last day of its month) |
| transfer | 2025 | DBBL | no From in Notion; reason says DBBL, so DBBL to Cash |
| transfer | 2025 | Monthly Withdraw | no From in Notion; dollars and taka both given, so Payoneer V2 to DBBL |
| transfer | 2025 | Monthly Withdraw | no From in Notion; dollars and taka both given, so Payoneer V2 to DBBL |
