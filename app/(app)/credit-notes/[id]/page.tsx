import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCreditNoteById } from "@/server/services/credit-notes";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { CreditNoteActionsBar } from "@/components/credit-notes/credit-note-actions-bar";
import { CREDIT_NOTE_STATUS_LABELS } from "@/lib/validations/credit-notes";
import { BackButton } from "@/components/shared/back-button";

interface CreditNoteDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CreditNoteDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const creditNote = await getCreditNoteById(id);
  return { title: creditNote?.credit_note_number ?? "Credit Note" };
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  issued: "default",
  cancelled: "destructive",
};

export default async function CreditNoteDetailPage({ params }: CreditNoteDetailPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "invoices")) redirect("/dashboard");

  const { id } = await params;
  const creditNote = await getCreditNoteById(id);
  if (!creditNote) notFound();

  const settings = await getCompanySettings();
  const currency = settings.default_currency;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/credit-notes" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{creditNote.credit_note_number}</h1>
            <Badge variant={STATUS_VARIANTS[creditNote.status]}>{CREDIT_NOTE_STATUS_LABELS[creditNote.status]}</Badge>
          </div>
          <p className="text-muted-foreground">
            <Link href={`/customers/${creditNote.customer_id}`} className="hover:underline">
              {creditNote.customers?.company_name}
            </Link>
            {creditNote.invoices ? (
              <>
                {" "}
                · Relates to{" "}
                <Link href={`/invoices/${creditNote.invoice_id}`} className="hover:underline">
                  {creditNote.invoices.invoice_number}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <CreditNoteActionsBar creditNote={creditNote} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total credit</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatCurrency(creditNote.total, currency)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Date</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {new Date(creditNote.credit_note_date).toLocaleDateString("en-ZA")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reason</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">{creditNote.reason || "—"}</CardContent>
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
              {creditNote.credit_note_items.map((item) => (
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
              <span>{formatCurrency(creditNote.subtotal, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>-{formatCurrency(creditNote.discount_total, currency)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">VAT</span>
              <span>{formatCurrency(creditNote.vat_total, currency)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 font-semibold">
              <span>Total</span>
              <span>{formatCurrency(creditNote.total, currency)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {creditNote.notes || creditNote.terms ? (
        <Card>
          <CardHeader>
            <CardTitle>Notes &amp; terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {creditNote.notes ? (
              <div>
                <div className="text-muted-foreground">Notes</div>
                <div className="whitespace-pre-line">{creditNote.notes}</div>
              </div>
            ) : null}
            {creditNote.terms ? (
              <div>
                <div className="text-muted-foreground">Terms</div>
                <div className="whitespace-pre-line">{creditNote.terms}</div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
