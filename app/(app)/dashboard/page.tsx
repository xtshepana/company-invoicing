import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getDashboardSummary } from "@/server/services/dashboard";
import { requireUser, hasModuleAccess } from "@/server/services/auth";
import { getInvoiceSummaryTotals } from "@/server/services/invoices";
import { getReconciliationStats } from "@/server/services/bank-transactions";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";

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
  "backup.exported": "exported a full data backup",
};

export default async function DashboardPage() {
  const profile = await requireUser();
  const canSeeInvoices = hasModuleAccess(profile, "invoices");
  const canSeeBanking = hasModuleAccess(profile, "banking");
  const [summary, settings, invoiceTotals, reconciliationStats] = await Promise.all([
    getDashboardSummary(),
    getCompanySettings(),
    canSeeInvoices ? getInvoiceSummaryTotals() : null,
    canSeeBanking ? getReconciliationStats() : null,
  ]);
  const currency = settings.default_currency;

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
