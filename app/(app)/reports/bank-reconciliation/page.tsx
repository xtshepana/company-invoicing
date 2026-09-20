import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getBankReconciliationReport } from "@/server/services/reports";
import { bankReconciliationReportSearchSchema } from "@/lib/validations/reports";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";

export const metadata: Metadata = { title: "Bank Reconciliation Report" };

interface BankReconciliationReportPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function BankReconciliationReportPage({ searchParams }: BankReconciliationReportPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "reports")) redirect("/dashboard");

  const params = bankReconciliationReportSearchSchema.parse(await searchParams);
  const [report, settings] = await Promise.all([
    getBankReconciliationReport(params.start, params.end),
    getCompanySettings(),
  ]);
  const currency = settings.default_currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank Reconciliation Report</h1>
          <p className="text-muted-foreground">
            How much moved through the bank feed in a period, and how much of it is still unreconciled — by value,
            not just by count. See Bank Reconciliation for the live, all-time worklist.
          </p>
        </div>
        <Button
          variant="outline"
          render={<a href={`/api/reports/bank-reconciliation.csv?start=${params.start}&end=${params.end}`} />}
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Matched</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.matchedAmount, currency)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">{report.matchedCount} transactions</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unmatched</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.unmatchedAmount, currency)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">{report.unmatchedCount} transactions</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ignored</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.ignoredAmount, currency)}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0 text-sm text-muted-foreground">{report.ignoredCount} transactions</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transactions in period</CardTitle>
          <CardDescription>
            {new Date(report.periodStart).toLocaleDateString("en-ZA")} – {new Date(report.periodEnd).toLocaleDateString("en-ZA")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {report.rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No bank transactions in this period.</p>
          ) : (
            <Table>
              <TableCaption className="sr-only">Bank transactions in period</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Matched customer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{new Date(row.date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell className="max-w-xs truncate">{row.description}</TableCell>
                    <TableCell>{row.reference || "—"}</TableCell>
                    <TableCell className={`text-right ${row.amount < 0 ? "text-destructive" : ""}`}>
                      {formatCurrency(row.amount, currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={row.status === "matched" ? "default" : row.status === "ignored" ? "secondary" : "outline"}>
                        {row.status === "matched" ? "Matched" : row.status === "ignored" ? "Ignored" : "Unmatched"}
                      </Badge>
                    </TableCell>
                    <TableCell>{row.matchedCustomerName ?? "—"}</TableCell>
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
