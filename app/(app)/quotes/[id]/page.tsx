import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getQuoteById } from "@/server/services/quotes";
import { getQuoteDisplayStatus } from "@/lib/validations/quotes";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { QuoteActionsBar } from "@/components/documents/quote-actions-bar";
import { BackButton } from "@/components/shared/back-button";

interface QuoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: QuoteDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const quote = await getQuoteById(id);
  return { title: quote?.quote_number ?? "Quote" };
}

export default async function QuoteDetailPage({ params }: QuoteDetailPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "quotes")) redirect("/dashboard");

  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();

  const settings = await getCompanySettings();
  const currency = settings.default_currency;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/quotes" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{quote.quote_number}</h1>
            <Badge variant={getQuoteDisplayStatus(quote).variant}>{getQuoteDisplayStatus(quote).label}</Badge>
          </div>
          <p className="text-muted-foreground">
            {quote.customers?.company_name}
            {quote.reference ? ` · Ref ${quote.reference}` : ""}
          </p>
        </div>
        <QuoteActionsBar quote={quote} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quote date</CardTitle>
          </CardHeader>
          <CardContent>{new Date(quote.quote_date).toLocaleDateString("en-ZA")}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expiry date</CardTitle>
          </CardHeader>
          <CardContent>{quote.expiry_date ? new Date(quote.expiry_date).toLocaleDateString("en-ZA") : "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatCurrency(quote.total, currency)}</CardContent>
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
              {quote.quote_items.map((item) => (
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
