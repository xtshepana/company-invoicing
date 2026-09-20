import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getVatReport } from "@/server/services/reports";
import { vatReportSearchSchema } from "@/lib/validations/reports";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";

export const metadata: Metadata = { title: "VAT Report" };

interface VatReportPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function VatReportPage({ searchParams }: VatReportPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "reports")) redirect("/dashboard");

  const params = vatReportSearchSchema.parse(await searchParams);
  const [report, settings] = await Promise.all([getVatReport(params.start, params.end), getCompanySettings()]);
  const currency = settings.default_currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">VAT Report</h1>
          <p className="text-muted-foreground">
            Output VAT only — this app doesn&apos;t track expenses, so there is no input VAT to net against.
          </p>
        </div>
        <Button
          variant="outline"
          render={<a href={`/api/reports/vat.csv?start=${params.start}&end=${params.end}`} />}
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
            <CardTitle className="text-2xl">{formatCurrency(report.salesExclVat, currency)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Output VAT</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.outputVat, currency)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Credit notes VAT</CardDescription>
            <CardTitle className="text-2xl">-{formatCurrency(report.creditNotesVat, currency)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Net VAT payable</CardDescription>
            <CardTitle className="text-2xl">{formatCurrency(report.netVatPayable, currency)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Documents in period</CardTitle>
          <CardDescription>
            {new Date(report.periodStart).toLocaleDateString("en-ZA")} – {new Date(report.periodEnd).toLocaleDateString("en-ZA")}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {report.rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No invoices or credit notes in this period.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Excl. VAT</TableHead>
                  <TableHead className="text-right">VAT</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row) => (
                  <TableRow key={`${row.documentType}-${row.documentId}`}>
                    <TableCell>{new Date(row.date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>{row.documentType === "invoice" ? "Invoice" : "Credit Note"}</TableCell>
                    <TableCell>
                      <Link
                        href={row.documentType === "invoice" ? `/invoices/${row.documentId}` : `/credit-notes/${row.documentId}`}
                        className="hover:underline"
                      >
                        {row.documentNumber}
                      </Link>
                    </TableCell>
                    <TableCell>{row.customerName}</TableCell>
                    <TableCell className="text-right">
                      {row.documentType === "credit_note" ? "-" : ""}
                      {formatCurrency(row.subtotal, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.documentType === "credit_note" ? "-" : ""}
                      {formatCurrency(row.vatAmount, currency)}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.documentType === "credit_note" ? "-" : ""}
                      {formatCurrency(row.total, currency)}
                    </TableCell>
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
