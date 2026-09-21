import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getSalesReport } from "@/server/services/reports";
import { salesReportSearchSchema } from "@/lib/validations/reports";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payments";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Sales & Income Report" };

interface SalesReportPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function SalesReportPage({ searchParams }: SalesReportPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "reports")) redirect("/dashboard");

  const params = salesReportSearchSchema.parse(await searchParams);
  const [report, settings] = await Promise.all([getSalesReport(params.start, params.end), getCompanySettings()]);
  const currency = settings.default_currency;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/reports" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sales &amp; Income Report</h1>
          <p className="text-muted-foreground">
            Sales is accrual (invoiced revenue, by invoice date); income is cash (payments actually received, by
            payment date) — an unpaid invoice adds to sales but not income, and a customer paying an old invoice
            adds to income but not new sales.
          </p>
        </div>
        <Button
          variant="outline"
          render={<a href={`/api/reports/sales.csv?start=${params.start}&end=${params.end}`} />}
          nativeButton={false}
        >
          <Download /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <label htmlFor="start" className="text-sm font-medium">
                From
              </label>
              <input
                id="start"
                name="start"
                type="date"
                defaultValue={params.start}
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="end" className="text-sm font-medium">
                To
              </label>
              <input
                id="end"
                name="end"
                type="date"
                defaultValue={params.end}
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              />
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sales (excl. VAT)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.invoicedExclVat, currency)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sales (incl. VAT)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.invoicedInclVat, currency)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Income (payments received)</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.paymentsReceived, currency)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Invoices / payments</CardDescription>
            <CardTitle className="text-2xl">
              {report.invoiceCount} / {report.paymentCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Invoices in period</CardTitle>
          <CardDescription>
            {new Date(report.periodStart).toLocaleDateString("en-ZA")} – {new Date(report.periodEnd).toLocaleDateString("en-ZA")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {report.invoices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No invoices in this period.</p>
          ) : (
            <Table>
              <TableCaption className="sr-only">Invoices in period</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Excl. VAT</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.invoices.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>
                      <Link href={`/invoices/${row.id}`} className="hover:underline">
                        {row.invoiceNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.subtotal, currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.vatTotal, currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.total, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments received in period</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {report.payments.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No payments recorded in this period.</p>
          ) : (
            <Table>
              <TableCaption className="sr-only">Payments received in period</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.payments.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell>{PAYMENT_METHOD_LABELS[row.paymentMethod as keyof typeof PAYMENT_METHOD_LABELS] ?? row.paymentMethod}</TableCell>
                    <TableCell>{row.bankReference || "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.amount, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
