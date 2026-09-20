import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Banknote, FileMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getInvoiceById } from "@/server/services/invoices";
import { getCustomerCreditBalance, getInvoicePaymentHistory } from "@/server/services/payments";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { InvoiceActionsBar } from "@/components/documents/invoice-actions-bar";
import { ApplyCreditDialog } from "@/components/payments/apply-credit-dialog";

interface InvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: InvoiceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const invoice = await getInvoiceById(id);
  return { title: invoice?.invoice_number ?? "Invoice" };
}

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  cancelled: "Cancelled",
  void: "Void",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "outline",
  partially_paid: "outline",
  paid: "default",
  cancelled: "destructive",
  void: "destructive",
};

export default async function InvoiceDetailPage({ params }: InvoiceDetailPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "invoices")) redirect("/dashboard");

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();

  const canSeePayments = hasModuleAccess(profile, "payments");
  const [settings, creditBalance, paymentHistory] = await Promise.all([
    getCompanySettings(),
    canSeePayments ? getCustomerCreditBalance(invoice.customer_id) : Promise.resolve(0),
    canSeePayments ? getInvoicePaymentHistory(invoice.id) : Promise.resolve([]),
  ]);
  const currency = settings.default_currency;
  const today = new Date().toISOString().slice(0, 10);
  const overdue =
    invoice.status !== "cancelled" && invoice.status !== "void" && (invoice.balance_due ?? 0) > 0 && invoice.due_date < today;
  const balanceDue = invoice.balance_due ?? 0;
  const canTakePayment = !["cancelled", "void", "paid"].includes(invoice.status) && balanceDue > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoice_number}</h1>
            {overdue ? (
              <Badge variant="destructive">Overdue</Badge>
            ) : (
              <Badge variant={STATUS_VARIANTS[invoice.status]}>{STATUS_LABELS[invoice.status]}</Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {invoice.customers?.company_name}
            {invoice.reference ? ` · Ref ${invoice.reference}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canTakePayment && creditBalance > 0 ? (
            <ApplyCreditDialog
              customerId={invoice.customer_id}
              invoiceId={invoice.id}
              creditBalance={creditBalance}
              invoiceBalanceDue={balanceDue}
              currency={currency}
            />
          ) : null}
          {canTakePayment ? (
            <Button render={<Link href={`/payments/new?customer=${invoice.customer_id}`} />} nativeButton={false}>
              <Banknote /> Record Payment
            </Button>
          ) : null}
          {invoice.status !== "draft" && invoice.status !== "cancelled" ? (
            <Button
              variant="outline"
              render={<Link href={`/credit-notes/new?customer=${invoice.customer_id}&invoice=${invoice.id}`} />}
              nativeButton={false}
            >
              <FileMinus /> Create Credit Note
            </Button>
          ) : null}
          <InvoiceActionsBar invoice={invoice} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatCurrency(invoice.total, currency)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatCurrency(invoice.amount_paid, currency)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatCurrency(invoice.balance_due ?? 0, currency)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due date</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{new Date(invoice.due_date).toLocaleDateString("en-ZA")}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead>Disc %</TableHead>
                <TableHead>VAT %</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.invoice_items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-pre-line">{item.description}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unit_price, currency)}</TableCell>
                  <TableCell>{item.discount_percent}%</TableCell>
                  <TableCell>{item.vat_rate}%</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.line_total, currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="ml-auto flex max-w-xs flex-col gap-1 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatCurrency(invoice.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatCurrency(invoice.discount_total, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT</span>
              <span>{formatCurrency(invoice.vat_total, currency)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(invoice.total, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {invoice.notes || invoice.terms ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes &amp; terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {invoice.notes ? (
              <div>
                <div className="text-muted-foreground">Notes</div>
                <div className="whitespace-pre-line">{invoice.notes}</div>
              </div>
            ) : null}
            {invoice.terms ? (
              <div>
                <div className="text-muted-foreground">Terms</div>
                <div className="whitespace-pre-line">{invoice.terms}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {canSeePayments ? (
        <Card>
          <CardHeader>
            <CardTitle>Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {paymentHistory.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No payments recorded against this invoice yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paymentHistory.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.date).toLocaleDateString("en-ZA")}</TableCell>
                      <TableCell>{entry.description}</TableCell>
                      <TableCell className="text-right">{formatCurrency(entry.amount, currency)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
