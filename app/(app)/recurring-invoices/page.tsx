import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getRecurringSummary, listRecurringInvoices } from "@/server/services/recurring-invoices";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { recurringInvoiceSearchSchema, RECURRING_FREQUENCY_LABELS } from "@/lib/validations/recurring-invoices";

export const metadata: Metadata = { title: "Recurring Invoices" };

const STATUS_LABELS: Record<string, string> = { active: "Active", paused: "Paused", cancelled: "Cancelled" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  paused: "secondary",
  cancelled: "destructive",
};

interface RecurringInvoicesPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RecurringInvoicesPage({ searchParams }: RecurringInvoicesPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "recurring_invoices")) redirect("/dashboard");

  const params = recurringInvoiceSearchSchema.parse(await searchParams);
  // The summary covers every recurring invoice matching the filters, not just the page being viewed.
  const [result, summary, settings] = await Promise.all([
    listRecurringInvoices(params),
    getRecurringSummary(params),
    getCompanySettings(),
  ]);
  const currency = settings.default_currency;
  const filtered = Boolean(params.q) || params.status !== "active";
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status !== "active") sp.set("status", params.status);
    sp.set("page", String(page));
    return `/recurring-invoices?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recurring Invoices</h1>
          <p className="text-muted-foreground">Bill customers automatically on a schedule.</p>
        </div>
        <Button render={<Link href="/recurring-invoices/new" />} nativeButton={false}>
          <Plus /> New Recurring Invoice
        </Button>
      </div>

      <ListFilters
        searchValue={params.q}
        searchPlaceholder="Search by description…"
        selects={[
          {
            param: "status",
            value: params.status,
            options: [
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "cancelled", label: "Cancelled" },
              { value: "all", label: "All" },
            ],
          },
        ]}
      />

      {summary.count > 0 ? (
        <div className="space-y-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Recurring invoices</CardDescription>
                <CardTitle className="text-3xl">{summary.count}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {summary.customerCount} {summary.customerCount === 1 ? "client" : "clients"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>{filtered ? "Total per month, matching your filters" : "Total per month, all clients"}</CardDescription>
                <CardTitle className="text-3xl">{formatCurrency(summary.monthlyTotal, currency)}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                {summary.convertsToMonthly
                  ? summary.byFrequency
                      .map((group) => `${group.count} ${RECURRING_FREQUENCY_LABELS[group.frequency].toLowerCase()} (${formatCurrency(group.total, currency)} each cycle)`)
                      .join(" · ")
                  : "Added up from every client's monthly invoice"}
              </CardContent>
            </Card>
          </div>
          <p className="text-xs text-muted-foreground">
            {filtered ? "Totals cover every recurring invoice matching the filters above, not just this page. " : ""}
            {summary.convertsToMonthly
              ? "Invoices billed more or less often than monthly are converted to a monthly equivalent."
              : "Amounts include VAT only where it is charged."}
          </p>
        </div>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Repeat className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q || params.status !== "active"
                  ? "No recurring invoices match your filters."
                  : "No recurring invoices configured."}
              </p>
              {!params.q && params.status === "active" ? (
                <Button size="sm" render={<Link href="/recurring-invoices/new" />} nativeButton={false}>
                  <Plus /> New Recurring Invoice
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">Recurring invoices</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Next invoice</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((recurring) => (
                  <TableRow key={recurring.id}>
                    <TableCell className="font-medium">
                      <Link href={`/recurring-invoices/${recurring.id}`} className="hover:underline">
                        {recurring.description}
                      </Link>
                    </TableCell>
                    <TableCell>{recurring.customers?.company_name ?? "—"}</TableCell>
                    <TableCell>{RECURRING_FREQUENCY_LABELS[recurring.frequency]}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(recurring.amount, currency)}</TableCell>
                    <TableCell>{new Date(recurring.next_invoice_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[recurring.status]}>{STATUS_LABELS[recurring.status]}</Badge>
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
