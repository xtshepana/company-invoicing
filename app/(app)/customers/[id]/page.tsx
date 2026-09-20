import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, FileText, Receipt, Banknote, FileBarChart, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCustomerById } from "@/server/services/customers";
import { getCustomerInvoiceSummary } from "@/server/services/invoices";
import { getCustomerCreditBalance, getCustomerRecentPayments } from "@/server/services/payments";
import { getCustomerRecentQuotes } from "@/server/services/quotes";
import { getCustomerRecentCreditNotes } from "@/server/services/credit-notes";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { ArchiveCustomerButton } from "@/components/customers/archive-customer-button";
import { PAYMENT_METHOD_LABELS } from "@/lib/validations/payments";
import { getQuoteDisplayStatus } from "@/lib/validations/quotes";
import { CREDIT_NOTE_STATUS_LABELS } from "@/lib/validations/credit-notes";

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: CustomerDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const customer = await getCustomerById(id);
  return { title: customer?.company_name ?? "Customer" };
}

const CUSTOMER_TYPE_LABELS: Record<string, string> = {
  business: "Business",
  individual: "Individual",
};

const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  cancelled: "Cancelled",
  void: "Void",
};

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "customers")) redirect("/dashboard");

  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const canInvoice = hasModuleAccess(profile, "invoices");
  const canQuote = hasModuleAccess(profile, "quotes");
  const canPayments = hasModuleAccess(profile, "payments");
  const canRecurring = hasModuleAccess(profile, "recurring_invoices");
  const [settings, invoiceSummary, creditBalance, recentPayments, recentQuotes, recentCreditNotes] = await Promise.all([
    getCompanySettings(),
    canInvoice ? getCustomerInvoiceSummary(id) : null,
    canPayments ? getCustomerCreditBalance(id) : null,
    canPayments ? getCustomerRecentPayments(id) : [],
    canQuote ? getCustomerRecentQuotes(id) : null,
    canInvoice ? getCustomerRecentCreditNotes(id) : null,
  ]);
  const currency = settings.default_currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.company_name}</h1>
            <Badge variant={customer.is_active ? "default" : "secondary"}>
              {customer.is_active ? "Active" : "Archived"}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            {CUSTOMER_TYPE_LABELS[customer.customer_type]}
            {customer.customer_reference ? ` · Ref ${customer.customer_reference}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canQuote ? (
            <Button variant="outline" render={<Link href={`/quotes/new?customer=${customer.id}`} />} nativeButton={false}>
              <FileText /> Create Quote
            </Button>
          ) : null}
          {canInvoice ? (
            <Button render={<Link href={`/invoices/new?customer=${customer.id}`} />} nativeButton={false}>
              <Receipt /> Create Invoice
            </Button>
          ) : null}
          {canRecurring ? (
            <Button variant="outline" render={<Link href={`/recurring-invoices/new?customer=${customer.id}`} />} nativeButton={false}>
              <Repeat /> Create Recurring Invoice
            </Button>
          ) : null}
          {canPayments ? (
            <Button variant="outline" render={<Link href={`/payments/new?customer=${customer.id}`} />} nativeButton={false}>
              <Banknote /> Record Payment
            </Button>
          ) : null}
          <Button variant="outline" render={<Link href={`/customers/${customer.id}/statement`} />} nativeButton={false}>
            <FileBarChart /> Statement
          </Button>
          <Button variant="outline" render={<Link href={`/customers/${customer.id}/edit`} />} nativeButton={false}>
            <Pencil /> Edit
          </Button>
          <ArchiveCustomerButton customerId={customer.id} isActive={customer.is_active} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Opening balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatCurrency(customer.opening_balance, currency)}</CardContent>
        </Card>
        <Card className={invoiceSummary ? "" : "opacity-70"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total invoiced</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {invoiceSummary ? formatCurrency(invoiceSummary.totalInvoiced, currency) : "—"}
          </CardContent>
        </Card>
        <Card className={invoiceSummary ? "" : "opacity-70"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {invoiceSummary ? formatCurrency(invoiceSummary.outstanding, currency) : "—"}
          </CardContent>
        </Card>
        <Card className={creditBalance != null ? "" : "opacity-70"}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Credit balance</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {creditBalance != null ? formatCurrency(creditBalance, currency) : "—"}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Contact person" value={customer.contact_person} />
            <DetailRow label="Email" value={customer.email} />
            <DetailRow label="Phone" value={customer.phone} />
            <DetailRow label="Mobile" value={customer.mobile} />
            <DetailRow label="VAT number" value={customer.vat_number} />
            <DetailRow label="Registration number" value={customer.registration_number} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-muted-foreground">Physical address</div>
              <div className="whitespace-pre-line">{customer.address_physical || "—"}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Postal address</div>
              <div className="whitespace-pre-line">{customer.address_postal || "—"}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <DetailRow
            label="Payment terms"
            value={customer.payment_terms_days != null ? `${customer.payment_terms_days} days` : "Company default"}
          />
          {customer.notes ? (
            <div>
              <div className="text-muted-foreground">Notes</div>
              <div className="whitespace-pre-line">{customer.notes}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {canQuote ? (
        <Card className={recentQuotes && recentQuotes.length > 0 ? "" : "opacity-70"}>
          <CardHeader>
            <CardTitle>Recent quotes</CardTitle>
          </CardHeader>
          <CardContent className={recentQuotes && recentQuotes.length > 0 ? "p-0" : ""}>
            {!recentQuotes || recentQuotes.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No quotes yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Quote #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentQuotes.map((quote) => (
                    <TableRow key={quote.id}>
                      <TableCell className="font-medium">
                        <Link href={`/quotes/${quote.id}`} className="hover:underline">
                          {quote.quote_number}
                        </Link>
                      </TableCell>
                      <TableCell>{new Date(quote.quote_date).toLocaleDateString("en-ZA")}</TableCell>
                      <TableCell>{formatCurrency(quote.total, currency)}</TableCell>
                      <TableCell>{getQuoteDisplayStatus(quote).label}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Card className={invoiceSummary && invoiceSummary.recentInvoices.length > 0 ? "" : "opacity-70"}>
        <CardHeader>
          <CardTitle>Recent invoices</CardTitle>
        </CardHeader>
        <CardContent className={invoiceSummary && invoiceSummary.recentInvoices.length > 0 ? "p-0" : ""}>
          {!invoiceSummary ? (
            <p className="p-6 text-sm text-muted-foreground">Available once invoicing is enabled.</p>
          ) : invoiceSummary.recentInvoices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No invoices yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoiceSummary.recentInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">
                      <Link href={`/invoices/${invoice.id}`} className="hover:underline">
                        {invoice.invoice_number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(invoice.invoice_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>{formatCurrency(invoice.total, currency)}</TableCell>
                    <TableCell>{formatCurrency(invoice.balance_due ?? 0, currency)}</TableCell>
                    <TableCell>{INVOICE_STATUS_LABELS[invoice.status]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {canInvoice ? (
        <Card className={recentCreditNotes && recentCreditNotes.length > 0 ? "" : "opacity-70"}>
          <CardHeader>
            <CardTitle>Recent credit notes</CardTitle>
          </CardHeader>
          <CardContent className={recentCreditNotes && recentCreditNotes.length > 0 ? "p-0" : ""}>
            {!recentCreditNotes || recentCreditNotes.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No credit notes yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Credit note #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCreditNotes.map((creditNote) => (
                    <TableRow key={creditNote.id}>
                      <TableCell className="font-medium">
                        <Link href={`/credit-notes/${creditNote.id}`} className="hover:underline">
                          {creditNote.credit_note_number}
                        </Link>
                      </TableCell>
                      <TableCell>{new Date(creditNote.credit_note_date).toLocaleDateString("en-ZA")}</TableCell>
                      <TableCell>{formatCurrency(creditNote.total, currency)}</TableCell>
                      <TableCell>{CREDIT_NOTE_STATUS_LABELS[creditNote.status]}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {canPayments ? (
        <Card className={recentPayments.length > 0 ? "" : "opacity-70"}>
          <CardHeader>
            <CardTitle>Recent payments</CardTitle>
          </CardHeader>
          <CardContent className={recentPayments.length > 0 ? "p-0" : ""}>
            {recentPayments.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No payments recorded yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <Link href={`/payments/${payment.id}`} className="hover:underline">
                          {new Date(payment.payment_date).toLocaleDateString("en-ZA")}
                        </Link>
                      </TableCell>
                      <TableCell>{PAYMENT_METHOD_LABELS[payment.payment_method]}</TableCell>
                      <TableCell>{payment.bank_reference || "—"}</TableCell>
                      <TableCell className="text-right">{formatCurrency(payment.amount, currency)}</TableCell>
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}
