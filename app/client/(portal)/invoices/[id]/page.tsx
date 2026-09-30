import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClientSession, requireClientSession } from "@/server/services/client-auth";
import { getClientInvoiceById } from "@/server/services/client-portal";
import { getPublicCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { BackButton } from "@/components/shared/back-button";

interface ClientInvoicePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ClientInvoicePageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getClientSession();
  const invoice = session ? await getClientInvoiceById(session, id) : null;
  return { title: invoice?.invoice_number ?? "Invoice" };
}

export default async function ClientInvoicePage({ params }: ClientInvoicePageProps) {
  const { id } = await params;
  const session = await requireClientSession();
  const [invoice, settings] = await Promise.all([getClientInvoiceById(session, id), getPublicCompanySettings()]);
  if (!invoice) notFound();

  const currency = settings.defaultCurrency;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/client" />
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoice_number}</h1>
          <Badge variant="outline">{invoice.status}</Badge>
        </div>
        {invoice.reference ? <p className="text-muted-foreground">Ref {invoice.reference}</p> : null}
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Balance due</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {formatCurrency(invoice.balance_due ?? 0, currency)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Due date</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {new Date(invoice.due_date).toLocaleDateString("en-ZA")}
          </CardContent>
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
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoice.invoice_items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-pre-line">{item.description}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unit_price, currency)}</TableCell>
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
    </div>
  );
}
