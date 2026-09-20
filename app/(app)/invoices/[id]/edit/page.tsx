import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getInvoiceById } from "@/server/services/invoices";
import { listAllActiveCustomers } from "@/server/services/customers";
import { listAllActiveProducts } from "@/server/services/products";
import { getCompanySettings } from "@/lib/config/system-settings";
import { InvoiceForm } from "@/components/documents/invoice-form";

export const metadata: Metadata = { title: "Edit Invoice" };

interface EditInvoicePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditInvoicePage({ params }: EditInvoicePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "invoices")) redirect("/dashboard");

  const { id } = await params;
  const invoice = await getInvoiceById(id);
  if (!invoice) notFound();
  if (["paid", "void", "cancelled"].includes(invoice.status) || invoice.amount_paid > 0) {
    redirect(`/invoices/${id}`);
  }

  const [customers, products, settings] = await Promise.all([
    listAllActiveCustomers(),
    listAllActiveProducts(),
    getCompanySettings(),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Invoice</h1>
        <p className="text-muted-foreground">{invoice.invoice_number}</p>
      </div>
      <InvoiceForm
        invoice={invoice}
        customers={customers}
        products={products}
        defaultVatRate={settings.default_vat_rate}
        defaultCurrency={settings.default_currency}
        defaultTerms={settings.default_invoice_footer}
        defaultPaymentTermsDays={settings.default_payment_terms_days}
      />
    </div>
  );
}
