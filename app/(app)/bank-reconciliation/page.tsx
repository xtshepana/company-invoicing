import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Upload, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { AutoMatchButton } from "@/components/bank/auto-match-button";
import { TransactionRowActions } from "@/components/bank/transaction-row-actions";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listBankTransactions, getReconciliationStats } from "@/server/services/bank-transactions";
import { bankTransactionSearchSchema, BANK_TRANSACTION_STATUS_LABELS } from "@/lib/validations/bank-transactions";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";

export const metadata: Metadata = { title: "Bank Reconciliation" };

interface BankReconciliationPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function BankReconciliationPage({ searchParams }: BankReconciliationPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "banking")) redirect("/dashboard");

  const params = bankTransactionSearchSchema.parse(await searchParams);
  const [result, stats, settings] = await Promise.all([
    listBankTransactions(params),
    getReconciliationStats(),
    getCompanySettings(),
  ]);
  const currency = settings.default_currency;
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status !== "unmatched") sp.set("status", params.status);
    sp.set("page", String(page));
    return `/bank-reconciliation?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bank Reconciliation</h1>
          <p className="text-muted-foreground">Import bank statements and match transactions to payments.</p>
        </div>
        <div className="flex gap-2">
          <AutoMatchButton />
          <Button render={<Link href="/bank-reconciliation/import" />} nativeButton={false}>
            <Upload /> Import Statement
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Unmatched</CardDescription>
            <CardTitle className="text-3xl">{stats.unmatched}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Matched</CardDescription>
            <CardTitle className="text-3xl">{stats.matched}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ignored</CardDescription>
            <CardTitle className="text-3xl">{stats.ignored}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <ListFilters
        searchValue={params.q}
        searchPlaceholder="Search by description or reference…"
        selects={[
          {
            param: "status",
            value: params.status,
            options: [
              { value: "unmatched", label: "Unmatched" },
              { value: "matched", label: "Matched" },
              { value: "ignored", label: "Ignored" },
              { value: "all", label: "All" },
            ],
          },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Landmark className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q
                  ? "No bank transactions match your search."
                  : params.status === "unmatched"
                    ? "No unmatched transactions — everything is reconciled, or nothing has been imported yet."
                    : "No bank transactions in this view yet."}
              </p>
              <Button size="sm" render={<Link href="/bank-reconciliation/import" />} nativeButton={false}>
                <Upload /> Import Statement
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Matched payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((txn) => (
                  <TableRow key={txn.id}>
                    <TableCell>{new Date(txn.transaction_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell className="max-w-xs truncate">{txn.description}</TableCell>
                    <TableCell>{txn.reference || "—"}</TableCell>
                    <TableCell className={`text-right ${txn.amount < 0 ? "text-destructive" : ""}`}>
                      {formatCurrency(txn.amount, currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={txn.status === "matched" ? "default" : txn.status === "ignored" ? "secondary" : "outline"}>
                        {BANK_TRANSACTION_STATUS_LABELS[txn.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {txn.payments ? (
                        <Link href={`/payments/${txn.payments.id}`} className="hover:underline">
                          {txn.payments.customers?.company_name ?? "Payment"}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <TransactionRowActions
                        id={txn.id}
                        status={txn.status}
                        amount={txn.amount}
                        transactionDate={txn.transaction_date}
                        description={txn.description}
                        reference={txn.reference}
                        currency={currency}
                      />
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
