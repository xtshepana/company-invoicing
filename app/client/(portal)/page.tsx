import type { Metadata } from "next";
import Link from "next/link";
import { requireClientSession } from "@/server/services/client-auth";
import { listClientQuotes, listClientInvoices } from "@/server/services/client-portal";
import { getPublicCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const metadata: Metadata = { title: "Your account" };

const QUOTE_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "outline",
  accepted: "default",
  rejected: "destructive",
  expired: "secondary",
  cancelled: "destructive",
};

const INVOICE_STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  sent: "outline",
  partially_paid: "outline",
  paid: "default",
  cancelled: "destructive",
  void: "destructive",
};

export default async function ClientDashboardPage() {
  const session = await requireClientSession();
  const [quotes, invoices, settings] = await Promise.all([
    listClientQuotes(session),
    listClientInvoices(session),
    getPublicCompanySettings(),
  ]);
  const currency = settings.defaultCurrency;
  const outstanding = invoices.reduce((sum, inv) => sum + (inv.balance_due ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your account</h1>
        <p className="text-muted-foreground">Quotes and invoices from {settings.companyName}.</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding balance</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-semibold">{formatCurrency(outstanding, currency)}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quotes</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {quotes.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No quotes yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotes.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell>
                      <Link href={`/client/quotes/${quote.id}`} className="hover:underline">
                        {quote.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(quote.quote_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>
                      <Badge variant={QUOTE_STATUS_VARIANTS[quote.status] ?? "outline"}>{quote.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(quote.total, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Invoices</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Balance due</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      <Link href={`/client/invoices/${invoice.id}`} className="hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(invoice.due_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>
                      <Badge variant={INVOICE_STATUS_VARIANTS[invoice.status] ?? "outline"}>{invoice.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(invoice.balance_due ?? 0, currency)}</TableCell>
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
