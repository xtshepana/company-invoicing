import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardSummary } from "@/server/services/dashboard";
import { requireUser, hasModuleAccess } from "@/server/services/auth";
import {
  getInvoiceSummaryTotals,
  getInvoiceCountStats,
  getRecentInvoices,
  getMonthlyInvoicedTotals,
  getInvoiceStatusBreakdown,
} from "@/server/services/invoices";
import { getReconciliationStats } from "@/server/services/bank-transactions";
import { getActiveCustomerCount } from "@/server/services/customers";
import { getPaidThisMonth, getRecentPayments, getMonthlyPaymentTotals } from "@/server/services/payments";
import { getExpensesThisMonth } from "@/server/services/expenses";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { InvoiceStatusChart } from "@/components/dashboard/invoice-status-chart";

const REVENUE_CHART_MONTHS = 6;

function monthLabel(key: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString("en-ZA", { month: "short", timeZone: "UTC" });
}

function buildRevenueSeries(
  invoiced: { month: string; total: number }[],
  paid: { month: string; total: number }[]
) {
  const now = new Date();
  const months: string[] = [];
  for (let i = REVENUE_CHART_MONTHS - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const invoicedMap = new Map(invoiced.map((r) => [r.month, r.total]));
  const paidMap = new Map(paid.map((r) => [r.month, r.total]));
  return months.map((key) => ({
    label: monthLabel(key),
    invoiced: invoicedMap.get(key) ?? 0,
    paid: paidMap.get(key) ?? 0,
  }));
}

export const metadata: Metadata = { title: "Dashboard" };

const ACTION_LABELS: Record<string, string> = {
  "user.login": "signed in",
  "user.logout": "signed out",
  "user.password_reset": "reset their password",
  "user.password_changed": "changed their password",
  "user.invited": "invited a new user",
  "user.role_updated": "updated a user's role",
  "user.deactivated": "deactivated a user",
  "user.reactivated": "reactivated a user",
  "profile.updated": "updated their profile",
  "company_settings.profile_updated": "updated the company profile",
  "company_settings.bank_details_updated": "updated the bank details",
  "company_settings.invoice_settings_updated": "updated the invoice settings",
  "customer.created": "added a customer",
  "customer.updated": "updated a customer",
  "customer.archived": "archived a customer",
  "customer.reactivated": "reactivated a customer",
  "product.created": "added a product/service",
  "product.updated": "updated a product/service",
  "product.archived": "archived a product/service",
  "product.reactivated": "reactivated a product/service",
  "quote.created": "created a quote",
  "quote.updated": "updated a quote",
  "quote.status_changed": "changed a quote's status",
  "quote.converted_to_invoice": "converted a quote to an invoice",
  "invoice.created": "created an invoice",
  "invoice.updated": "updated an invoice",
  "invoice.created_from_quote": "generated an invoice from a quote",
  "invoice.marked_sent": "marked an invoice as sent",
  "invoice.voided": "voided an invoice",
  "invoice.cancelled": "cancelled an invoice",
  "bank_transactions.imported": "imported a bank statement",
  "bank_transaction.matched": "matched a bank transaction",
  "bank_transaction.unmatched": "unmatched a bank transaction",
  "bank_transaction.ignored": "ignored a bank transaction",
  "bank_transaction.restored": "restored an ignored bank transaction",
  "bank_transactions.auto_matched": "ran automatic bank matching",
  "credit_note.created": "created a credit note",
  "credit_note.updated": "updated a credit note",
  "credit_note.issued": "issued a credit note",
  "credit_note.cancelled": "cancelled a credit note",
  "supplier.created": "added a supplier",
  "supplier.updated": "updated a supplier",
  "supplier.archived": "archived a supplier",
  "supplier.reactivated": "reactivated a supplier",
  "expense.created": "logged an expense",
  "expense.updated": "updated an expense",
  "expense.deleted": "deleted an expense",
  "backup.exported": "exported a full data backup",
};

export default async function DashboardPage() {
  const profile = await requireUser();
  const canSeeInvoices = hasModuleAccess(profile, "invoices");
  const canSeeBanking = hasModuleAccess(profile, "banking");
  const canSeeCustomers = hasModuleAccess(profile, "customers");
  const canSeePayments = hasModuleAccess(profile, "payments");
  const canSeeSuppliers = hasModuleAccess(profile, "suppliers");
  const [
    summary,
    settings,
    invoiceTotals,
    reconciliationStats,
    customerCount,
    invoiceCounts,
    paidThisMonth,
    recentInvoices,
    recentPayments,
    monthlyInvoiced,
    monthlyPaid,
    statusBreakdown,
    expensesThisMonth,
  ] = await Promise.all([
    getDashboardSummary(),
    getCompanySettings(),
    canSeeInvoices ? getInvoiceSummaryTotals() : null,
    canSeeBanking ? getReconciliationStats() : null,
    canSeeCustomers ? getActiveCustomerCount() : null,
    canSeeInvoices ? getInvoiceCountStats() : null,
    canSeePayments ? getPaidThisMonth() : null,
    canSeeInvoices ? getRecentInvoices(5) : null,
    canSeePayments ? getRecentPayments(5) : null,
    canSeeInvoices ? getMonthlyInvoicedTotals(REVENUE_CHART_MONTHS) : null,
    canSeePayments ? getMonthlyPaymentTotals(REVENUE_CHART_MONTHS) : null,
    canSeeInvoices ? getInvoiceStatusBreakdown() : null,
    canSeeSuppliers ? getExpensesThisMonth() : null,
  ]);
  const currency = settings.default_currency;
  const revenueSeries =
    monthlyInvoiced !== null || monthlyPaid !== null
      ? buildRevenueSeries(monthlyInvoiced ?? [], monthlyPaid ?? [])
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {profile.full_name || profile.email.split("@")[0]}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {invoiceTotals ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total sales</CardDescription>
                <CardTitle className="text-3xl">{formatCurrency(invoiceTotals.totalSales, currency)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Paid</CardDescription>
                <CardTitle className="text-3xl">{formatCurrency(invoiceTotals.totalPaid, currency)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Outstanding</CardDescription>
                <CardTitle className="text-3xl">{formatCurrency(invoiceTotals.outstanding, currency)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Overdue</CardDescription>
                <CardTitle className="text-3xl">{formatCurrency(invoiceTotals.overdue, currency)}</CardTitle>
              </CardHeader>
            </Card>
          </>
        ) : (
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active users</CardDescription>
              <CardTitle className="text-3xl">{summary.activeStaffCount}</CardTitle>
            </CardHeader>
          </Card>
        )}
        {reconciliationStats ? (
          <Link href="/bank-reconciliation">
            <Card className="transition-colors hover:bg-accent/50">
              <CardHeader className="pb-2">
                <CardDescription>Bank transactions to review</CardDescription>
                <CardTitle className="text-3xl">{reconciliationStats.unmatched}</CardTitle>
              </CardHeader>
            </Card>
          </Link>
        ) : (
          <Card className="opacity-70">
            <CardHeader className="pb-2">
              <CardDescription>Bank transactions to review</CardDescription>
              <CardTitle className="text-3xl">—</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" className="text-xs font-normal">
                Available once banking is enabled
              </Badge>
            </CardContent>
          </Card>
        )}
      </div>

      {revenueSeries || statusBreakdown ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {revenueSeries ? (
            <Card>
              <CardHeader>
                <CardTitle>Revenue by month</CardTitle>
                <CardDescription>Invoiced vs. paid over the last {REVENUE_CHART_MONTHS} months.</CardDescription>
              </CardHeader>
              <CardContent>
                <RevenueChart data={revenueSeries} currency={currency} />
              </CardContent>
            </Card>
          ) : null}
          {statusBreakdown ? (
            <Card>
              <CardHeader>
                <CardTitle>Invoice status</CardTitle>
                <CardDescription>Where your active invoices currently stand.</CardDescription>
              </CardHeader>
              <CardContent>
                <InvoiceStatusChart
                  draft={statusBreakdown.draft}
                  sent={statusBreakdown.sent}
                  paid={statusBreakdown.paid}
                  overdue={statusBreakdown.overdue}
                />
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {customerCount !== null || invoiceCounts !== null || paidThisMonth !== null || expensesThisMonth !== null ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {customerCount !== null ? (
            <Link href="/customers">
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader className="pb-2">
                  <CardDescription>Customers</CardDescription>
                  <CardTitle className="text-3xl">{customerCount}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ) : null}
          {invoiceCounts !== null ? (
            <>
              <Link href="/invoices">
                <Card className="h-full transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <CardDescription>Unpaid invoices</CardDescription>
                    <CardTitle className="text-3xl">{invoiceCounts.unpaidCount}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
              <Link href="/invoices?status=overdue">
                <Card className="h-full transition-colors hover:bg-accent/50">
                  <CardHeader className="pb-2">
                    <CardDescription>Overdue invoices</CardDescription>
                    <CardTitle className="text-3xl">{invoiceCounts.overdueCount}</CardTitle>
                  </CardHeader>
                </Card>
              </Link>
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>Invoiced this month</CardDescription>
                  <CardTitle className="text-3xl">{formatCurrency(invoiceCounts.invoicedThisMonth, currency)}</CardTitle>
                </CardHeader>
              </Card>
            </>
          ) : null}
          {paidThisMonth !== null ? (
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Paid this month</CardDescription>
                <CardTitle className="text-3xl">{formatCurrency(paidThisMonth, currency)}</CardTitle>
              </CardHeader>
            </Card>
          ) : null}
          {expensesThisMonth !== null ? (
            <Link href="/expenses">
              <Card className="h-full transition-colors hover:bg-accent/50">
                <CardHeader className="pb-2">
                  <CardDescription>Expenses this month</CardDescription>
                  <CardTitle className="text-3xl">{formatCurrency(expensesThisMonth, currency)}</CardTitle>
                </CardHeader>
              </Card>
            </Link>
          ) : null}
        </div>
      ) : null}

      {recentInvoices !== null || recentPayments !== null ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {recentInvoices !== null ? (
            <Card>
              <CardHeader>
                <CardTitle>Recent invoices</CardTitle>
              </CardHeader>
              <CardContent>
                {recentInvoices.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No invoices yet.</p>
                ) : (
                  <ul className="divide-y">
                    {recentInvoices.map((inv) => (
                      <li key={inv.id} className="flex items-center justify-between py-2 text-sm">
                        <Link href={`/invoices/${inv.id}`} className="hover:underline">
                          {inv.invoiceNumber} · {inv.customerName}
                        </Link>
                        <span className="text-muted-foreground">{formatCurrency(inv.total, currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
          {recentPayments !== null ? (
            <Card>
              <CardHeader>
                <CardTitle>Recent payments</CardTitle>
              </CardHeader>
              <CardContent>
                {recentPayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments recorded yet.</p>
                ) : (
                  <ul className="divide-y">
                    {recentPayments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                        <Link href={`/payments/${p.id}`} className="hover:underline">
                          {p.customerName}
                        </Link>
                        <span className="text-muted-foreground">{formatCurrency(p.amount, currency)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      ) : null}

      {profile.role === "owner_admin" ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>The latest actions recorded in the audit log.</CardDescription>
          </CardHeader>
          <CardContent>
            {summary.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <ul className="divide-y">
                {summary.recentActivity.map((item) => (
                  <li key={item.id} className="flex items-center justify-between py-2 text-sm">
                    <span>
                      <span className="font-medium">{item.actorName ?? "System"}</span>{" "}
                      {ACTION_LABELS[item.action] ?? item.action}
                    </span>
                    <span className="text-muted-foreground">
                      {new Date(item.createdAt).toLocaleString("en-ZA")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
