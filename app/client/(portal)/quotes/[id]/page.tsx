import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getClientSession, requireClientSession } from "@/server/services/client-auth";
import { getClientQuoteById } from "@/server/services/client-portal";
import { getPublicCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { QuoteResponseForm } from "@/components/client/quote-response-form";
import { BackButton } from "@/components/shared/back-button";

interface ClientQuotePageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: ClientQuotePageProps): Promise<Metadata> {
  const { id } = await params;
  const session = await getClientSession();
  const quote = session ? await getClientQuoteById(session, id) : null;
  return { title: quote?.quote_number ?? "Quote" };
}

export default async function ClientQuotePage({ params }: ClientQuotePageProps) {
  const { id } = await params;
  const session = await requireClientSession();
  const [quote, settings] = await Promise.all([getClientQuoteById(session, id), getPublicCompanySettings()]);
  if (!quote) notFound();

  const currency = settings.defaultCurrency;
  const today = new Date().toISOString().slice(0, 10);
  const canRespond = quote.status === "sent" && (!quote.expiry_date || quote.expiry_date >= today);

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/client" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{quote.quote_number}</h1>
            <Badge variant="outline">{quote.status}</Badge>
          </div>
          {quote.reference ? <p className="text-muted-foreground">Ref {quote.reference}</p> : null}
        </div>
        {canRespond ? <QuoteResponseForm quoteId={quote.id} /> : null}
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
              {quote.quote_items.map((item) => (
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
              <span>{formatCurrency(quote.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatCurrency(quote.discount_total, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT</span>
              <span>{formatCurrency(quote.vat_total, currency)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(quote.total, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {quote.notes || quote.terms ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes &amp; terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {quote.notes ? (
              <div>
                <div className="text-muted-foreground">Notes</div>
                <div className="whitespace-pre-line">{quote.notes}</div>
              </div>
            ) : null}
            {quote.terms ? (
              <div>
                <div className="text-muted-foreground">Terms</div>
                <div className="whitespace-pre-line">{quote.terms}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
