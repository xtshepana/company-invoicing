import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listExpenses } from "@/server/services/expenses";
import { expenseSearchSchema } from "@/lib/validations/suppliers";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { DeleteExpenseButton } from "@/components/expenses/delete-expense-button";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Expenses" };

interface ExpensesPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "suppliers")) redirect("/dashboard");

  const params = expenseSearchSchema.parse(await searchParams);
  const [result, settings] = await Promise.all([listExpenses(params), getCompanySettings()]);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));
  const currency = settings.default_currency;

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.sort !== "date_desc") sp.set("sort", params.sort);
    sp.set("page", String(page));
    return `/expenses?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/suppliers" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
          <p className="text-muted-foreground">Track money spent with your suppliers.</p>
        </div>
        <Button render={<Link href="/expenses/new" />} nativeButton={false}>
          <Plus /> Log Expense
        </Button>
      </div>

      <ListFilters
        searchValue={params.q}
        searchPlaceholder="Search by description or category…"
        selects={[
          {
            param: "sort",
            value: params.sort,
            options: [
              { value: "date_desc", label: "Newest first" },
              { value: "date_asc", label: "Oldest first" },
              { value: "amount_desc", label: "Amount (high to low)" },
              { value: "amount_asc", label: "Amount (low to high)" },
            ],
          },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q ? "No expenses match your filters." : "No expenses have been logged yet."}
              </p>
              {!params.q ? (
                <Button size="sm" render={<Link href="/expenses/new" />} nativeButton={false}>
                  <Plus /> Log Expense
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">Expenses</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="w-24" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell>{new Date(expense.expense_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/expenses/${expense.id}/edit`} className="hover:underline">
                        {expense.description}
                      </Link>
                    </TableCell>
                    <TableCell>{expense.suppliers?.company_name || "—"}</TableCell>
                    <TableCell>{expense.category || "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(expense.amount, currency)}</TableCell>
                    <TableCell>
                      <DeleteExpenseButton expenseId={expense.id} description={expense.description} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationBar page={result.page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
