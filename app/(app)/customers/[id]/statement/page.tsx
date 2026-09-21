import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Download, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCustomerStatement } from "@/server/services/statements";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { BackButton } from "@/components/shared/back-button";

interface StatementPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Customer Statement" };

export default async function CustomerStatementPage({ params }: StatementPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "customers") || !hasModuleAccess(profile, "payments")) redirect("/dashboard");

  const { id } = await params;
  const [statement, settings] = await Promise.all([getCustomerStatement(id), getCompanySettings()]);
  if (!statement) notFound();

  const currency = settings.default_currency;

  return (
    <div className="space-y-6">
      <div className="print:hidden">
        <BackButton fallbackHref={`/customers/${id}`} />
      </div>
      <div className="flex flex-wrap items-start justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Statement — {statement.customer.company_name}</h1>
          <p className="text-muted-foreground">As at {new Date().toLocaleDateString("en-ZA")}</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            render={<a href={`/api/pdf/statements/${id}`} target="_blank" rel="noreferrer" />}
            nativeButton={false}
          >
            <Download /> PDF
          </Button>
          <Button
            variant="outline"
            render={<a href={`/api/customers/${id}/statement.csv`} />}
            nativeButton={false}
          >
            <FileSpreadsheet /> CSV
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{statement.customer.company_name}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statement.lines.map((line, index) => (
                <TableRow key={index}>
                  <TableCell>{line.date ? new Date(line.date).toLocaleDateString("en-ZA") : "—"}</TableCell>
                  <TableCell>{line.reference || "—"}</TableCell>
                  <TableCell>{line.description}</TableCell>
                  <TableCell className="text-right">{line.debit > 0 ? formatCurrency(line.debit, currency) : ""}</TableCell>
                  <TableCell className="text-right">{line.credit > 0 ? formatCurrency(line.credit, currency) : ""}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(line.balance, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="ml-auto flex max-w-xs justify-between border-t pt-2 text-lg font-semibold">
        <span>Closing balance</span>
        <span>{formatCurrency(statement.closingBalance, currency)}</span>
      </div>
    </div>
  );
}
