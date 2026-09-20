import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getPaymentById } from "@/server/services/payments";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payments";

interface PaymentDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = { title: "Payment" };

const ALLOCATION_LABELS: Record<string, string> = {
  unallocated: "Unallocated",
  partially_allocated: "Partially allocated + credit",
  fully_allocated: "Fully allocated",
};

export default async function PaymentDetailPage({ params }: PaymentDetailPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "payments")) redirect("/dashboard");

  const { id } = await params;
  const payment = await getPaymentById(id);
  if (!payment) notFound();

  const settings = await getCompanySettings();
  const currency = settings.default_currency;
  const allocatedTotal = payment.payment_allocations.reduce((sum, a) => sum + a.amount, 0);
  const creditAmount = payment.amount - allocatedTotal;

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Payment from {payment.customers?.company_name}
          </h1>
          <Badge variant={payment.allocation_status === "fully_allocated" ? "default" : "secondary"}>
            {ALLOCATION_LABELS[payment.allocation_status]}
          </Badge>
        </div>
        <p className="text-muted-foreground">{new Date(payment.payment_date).toLocaleDateString("en-ZA")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Amount</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatCurrency(payment.amount, currency)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Method</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{PAYMENT_METHOD_LABELS[payment.payment_method]}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Allocated to invoices</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatCurrency(allocatedTotal, currency)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">To customer credit</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatCurrency(creditAmount, currency)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Allocations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {payment.payment_allocations.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              Not allocated to any invoice — recorded entirely as customer credit.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payment.payment_allocations.map((allocation) => (
                  <TableRow key={allocation.id}>
                    <TableCell>
                      <Link href={`/invoices/${allocation.invoice_id}`} className="hover:underline">
                        {allocation.invoices?.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(allocation.amount, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {payment.bank_reference || payment.description || payment.notes ? (
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {payment.bank_reference ? (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bank reference</span>
                <span>{payment.bank_reference}</span>
              </div>
            ) : null}
            {payment.description ? (
              <div>
                <div className="text-muted-foreground">Description</div>
                <div>{payment.description}</div>
              </div>
            ) : null}
            {payment.notes ? (
              <div>
                <div className="text-muted-foreground">Notes</div>
                <div className="whitespace-pre-line">{payment.notes}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
