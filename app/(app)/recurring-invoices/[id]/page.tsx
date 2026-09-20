import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getRecurringInvoiceById, getGeneratedInvoices } from "@/server/services/recurring-invoices";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { RECURRING_FREQUENCY_LABELS } from "@/lib/validations/recurring-invoices";
import { RecurringInvoiceActionsBar } from "@/components/documents/recurring-invoice-actions-bar";

interface RecurringInvoiceDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RecurringInvoiceDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const recurring = await getRecurringInvoiceById(id);
  return { title: recurring?.description ?? "Recurring Invoice" };
}

const STATUS_LABELS: Record<string, string> = { active: "Active", paused: "Paused", cancelled: "Cancelled" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  paused: "secondary",
  cancelled: "destructive",
};
const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  cancelled: "Cancelled",
  void: "Void",
};

export default async function RecurringInvoiceDetailPage({ params }: RecurringInvoiceDetailPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "recurring_invoices")) redirect("/dashboard");

  const { id } = await params;
  const recurring = await getRecurringInvoiceById(id);
  if (!recurring) notFound();

  const [settings, generatedInvoices] = await Promise.all([getCompanySettings(), getGeneratedInvoices(id)]);
  const currency = settings.default_currency;
  const total = recurring.recurring_invoice_items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{recurring.description}</h1>
            <Badge variant={STATUS_VARIANTS[recurring.status]}>{STATUS_LABELS[recurring.status]}</Badge>
          </div>
          <p className="text-muted-foreground">{recurring.customers?.company_name}</p>
        </div>
        <RecurringInvoiceActionsBar recurringInvoice={recurring} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Frequency</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{RECURRING_FREQUENCY_LABELS[recurring.frequency]}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Next invoice date</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {recurring.status === "active" ? new Date(recurring.next_invoice_date).toLocaleDateString("en-ZA") : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Last generated</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">
            {recurring.last_generated_date ? new Date(recurring.last_generated_date).toLocaleDateString("en-ZA") : "Never"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Amount per invoice</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">~{formatCurrency(total, currency)} excl. VAT</CardContent>
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
                <TableHead>VAT %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recurring.recurring_invoice_items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-pre-line">{item.description}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unit_price, currency)}</TableCell>
                  <TableCell>{item.vat_rate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className={generatedInvoices.length > 0 ? "" : "opacity-70"}>
        <CardHeader>
          <CardTitle>Generated invoices</CardTitle>
        </CardHeader>
        <CardContent className={generatedInvoices.length > 0 ? "p-0" : ""}>
          {generatedInvoices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No invoices generated yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {generatedInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      <Link href={`/invoices/${invoice.id}`} className="hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(invoice.invoice_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>{formatCurrency(invoice.total, currency)}</TableCell>
                    <TableCell>{INVOICE_STATUS_LABELS[invoice.status]}</TableCell>
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
