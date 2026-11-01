import Link from "next/link";
import { Tag, Trash2 } from "lucide-react";
import { PageTitle } from "@/components/page-title";
import { topbarAddClass } from "@/components/topbar";
import { Input, MoneyInput } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Page, Card, Empty } from "@/components/cashflow/shell";
import { AddRow, Select } from "@/components/cashflow/fields";
import { CatIcon, ICON_KEYS } from "@/components/cashflow/category-icon";
import { FirstRun } from "@/components/cashflow/first-run";
import { deleteCategory, saveCategory } from "@/app/money/actions";
import { getLedger } from "@/lib/ledger";
import { taka, toMajor } from "@/lib/money";
import { plural } from "@/lib/utils";
import type { Category } from "@/lib/cashflow";

export const metadata = { title: "Categories" };

/** Categories: the kinds of income and expense. Each carries an icon, a colour (from its name) and a monthly budget. */
export default async function CategoriesPage({ searchParams }: { searchParams?: { edit?: string } }) {
  const ledger = await getLedger();
  const expense = ledger.categories.filter((c) => c.kind === "expense");
  const income = ledger.categories.filter((c) => c.kind === "income");
  const editing = ledger.categories.find((c) => c.id === searchParams?.edit) ?? null;
  const count = new Map<string, number>();
  for (const t of ledger.tx) if (t.categoryId) count.set(t.categoryId, (count.get(t.categoryId) ?? 0) + 1);

  const list = (cats: Category[], kind: "expense" | "income") =>
    cats.length === 0 ? (
      <Empty title={`No ${kind} categories`} line="Add one below." />
    ) : (
      cats.map((c) => (
        <div key={c.id} className="flex items-center gap-3 border-t border-border py-[11px] first:border-t-0">
          <CatIcon icon={c.icon} name={c.name} />
          <div className="min-w-0 flex-1">
            <b className="block truncate text-[13.5px]">{c.name}</b>
            <small className="block text-[12px] text-muted-foreground">
              {kind === "expense"
                ? c.budgetMinor
                  ? `Budget ${taka(c.budgetMinor)} a month`
                  : "No budget"
                : plural(count.get(c.id) ?? 0, "entry", "entries")}
            </small>
          </div>
          {kind === "expense" && (
            <span className="hidden text-right text-[12px] text-muted-foreground sm:block">
              {plural(count.get(c.id) ?? 0, "entry", "entries")}
            </span>
          )}
          <Link
            href={`/categories?edit=${c.id}#category-form`}
            className="text-[13px] font-semibold text-foreground/70 hover:text-foreground"
          >
            Edit
          </Link>
          <form action={deleteCategory}>
            <input type="hidden" name="return_to" value="/categories" />
            <input type="hidden" name="id" value={c.id} />
            <button
              type="submit"
              className="grid h-8 w-8 place-items-center rounded-[7px] text-muted-foreground/60 hover:bg-[hsl(var(--destructive-soft))] hover:text-destructive"
              aria-label={`Remove ${c.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      ))
    );

  return (
    <Page
      title="Categories"
      add={
        <Link href="#category-form" className={topbarAddClass}>
          <Tag className="h-4 w-4" /> Add category
        </Link>
      }
    >
      <PageTitle
        title="Categories"
        line={
          <>
            <b>{plural(expense.length, "expense category", "expense categories")}</b> and <b>{income.length} income</b>.
            Each one carries its icon, colour and monthly budget into every page.
          </>
        }
      />
      {ledger.accounts.length === 0 && ledger.categories.length === 0 && <FirstRun returnTo="/categories" />}
      <div className="grid gap-3.5 sm:gap-[18px] lg:grid-cols-2">
        <Card title="Expenses" sub={plural(expense.length, "category", "categories")}>
          {list(expense, "expense")}
        </Card>
        <Card title="Income" sub={plural(income.length, "category", "categories")}>
          {list(income, "income")}
          <p className="mt-3.5 rounded-[10px] border border-dashed border-border-strong bg-[hsl(var(--surface-muted))] px-3 py-2 text-[12px] text-muted-foreground">
            Who paid you (Fiverr, a client) goes in the Source box on each entry, so a new client never needs a new
            category.
          </p>
        </Card>
      </div>
      <Card title={editing ? `Edit ${editing.name}` : "Add a category"} className="scroll-mt-20" bodyClass="p-0">
        <form action={saveCategory} id="category-form">
          <input type="hidden" name="return_to" value="/categories" />
          {editing && <input type="hidden" name="id" value={editing.id} />}
          <AddRow className="border-t-0 bg-transparent sm:grid-cols-[1fr_150px_170px_170px_auto]">
            <Input
              name="name"
              placeholder="Name, e.g. Ramadan, Bike"
              defaultValue={editing?.name}
              required
              aria-label="Category name"
              className="h-10"
            />
            <Select
              name="kind"
              defaultValue={editing?.kind ?? "expense"}
              disabled={Boolean(editing)}
              aria-label="Kind"
              className="h-10"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </Select>
            <Select name="icon" defaultValue={editing?.icon ?? "tag"} aria-label="Icon" className="h-10">
              {ICON_KEYS.map((k) => (
                <option key={k} value={k}>
                  Icon: {k.replace("-", " ")}
                </option>
              ))}
            </Select>
            <MoneyInput
              name="budget"
              placeholder="Monthly budget"
              defaultValue={editing?.budgetMinor ? toMajor(editing.budgetMinor) : undefined}
              min="0"
              step="1"
              aria-label="Monthly budget (expenses)"
              className="h-10"
            />
            <SubmitButton pendingText="Saving…" className="min-h-[40px]">
              {editing ? "Save" : "Add"}
            </SubmitButton>
          </AddRow>
        </form>
      </Card>
    </Page>
  );
}
