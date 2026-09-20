import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listPayments } from "@/server/services/payments";
import { paymentSearchSchema } from "@/lib/validations/payments";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payments";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";

export const metadata: Metadata = { title: "Payments" };

interface PaymentsPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const ALLOCATION_LABELS: Record<string, string> = {
  unallocated: "Unallocated",
  partially_allocated: "Partial + Credit",
  fully_allocated: "Fully Allocated",
};

export default async function PaymentsPage({ searchParams }: PaymentsPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "payments")) redirect("/dashboard");

  const params = paymentSearchSchema.parse(await searchParams);
  const [result, settings] = await Promise.all([listPayments(params), getCompanySettings()]);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    sp.set("page", String(page));
    return `/payments?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Payments</h1>
          <p className="text-muted-foreground">Every payment recorded against a customer.</p>
        </div>
        <Button render={<Link href="/payments/new" />} nativeButton={false}>
          <Plus /> Record Payment
        </Button>
      </div>

      <ListFilters searchValue={params.q} searchPlaceholder="Search by reference or description…" selects={[]} />

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Banknote className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q ? "No payments match your search." : "No payments have been recorded yet."}
              </p>
              {!params.q ? (
                <Button size="sm" render={<Link href="/payments/new" />} nativeButton={false}>
                  <Plus /> Record Payment
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>
                      <Link href={`/payments/${payment.id}`} className="hover:underline">
                        {new Date(payment.payment_date).toLocaleDateString("en-ZA")}
                      </Link>
                    </TableCell>
                    <TableCell>{payment.customers?.company_name ?? "—"}</TableCell>
                    <TableCell>{PAYMENT_METHOD_LABELS[payment.payment_method]}</TableCell>
                    <TableCell>{payment.bank_reference || "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(payment.amount, settings.default_currency)}</TableCell>
                    <TableCell>
                      <Badge variant={payment.allocation_status === "fully_allocated" ? "default" : "secondary"}>
                        {ALLOCATION_LABELS[payment.allocation_status]}
                      </Badge>
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
