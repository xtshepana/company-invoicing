import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getAgingReport } from "@/server/services/reports";
import { agingReportSearchSchema } from "@/lib/validations/reports";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Accounts Receivable Aging" };

interface AgingReportPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function AgingReportPage({ searchParams }: AgingReportPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "reports")) redirect("/dashboard");

  const params = agingReportSearchSchema.parse(await searchParams);
  const [report, settings] = await Promise.all([getAgingReport(params.asOf), getCompanySettings()]);
  const currency = settings.default_currency;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/reports" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Accounts Receivable Aging</h1>
          <p className="text-muted-foreground">Outstanding invoice balances by customer, as of a chosen date.</p>
        </div>
        <Button variant="outline" render={<a href={`/api/reports/aging.csv?asOf=${params.asOf}`} />} nativeButton={false}>
          <Download /> Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <label htmlFor="asOf" className="text-sm font-medium">
                As of
              </label>
              <input
                id="asOf"
                name="asOf"
                type="date"
                defaultValue={params.asOf}
                className="flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs"
              />
            </div>
            <Button type="submit" variant="outline">
              Apply
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Outstanding by customer</CardTitle>
          <CardDescription>As of {new Date(report.asOfDate).toLocaleDateString("en-ZA")}</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {report.rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No outstanding invoices as of this date.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">1-30 days</TableHead>
                  <TableHead className="text-right">31-60 days</TableHead>
                  <TableHead className="text-right">61-90 days</TableHead>
                  <TableHead className="text-right">90+ days</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.customerId}>
                    <TableCell>
                      <Link href={`/customers/${row.customerId}`} className="hover:underline">
                        {row.customerName}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.current, currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.days1to30, currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.days31to60, currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.days61to90, currency)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(row.days90plus, currency)}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(row.total, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-medium">Total</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(report.totals.current, currency)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(report.totals.days1to30, currency)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(report.totals.days31to60, currency)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(report.totals.days61to90, currency)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(report.totals.days90plus, currency)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(report.totals.total, currency)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
