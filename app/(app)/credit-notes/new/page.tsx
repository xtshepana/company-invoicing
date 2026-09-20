import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listAllActiveCustomers } from "@/server/services/customers";
import { listAllActiveProducts } from "@/server/services/products";
import { getCustomerInvoicesForCreditNote } from "@/server/services/credit-notes";
import { getCompanySettings } from "@/lib/config/system-settings";
import { CreditNoteForm } from "@/components/documents/credit-note-form";

export const metadata: Metadata = { title: "New Credit Note" };

interface NewCreditNotePageProps {
  searchParams: Promise<{ customer?: string; invoice?: string }>;
}

export default async function NewCreditNotePage({ searchParams }: NewCreditNotePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "invoices")) redirect("/dashboard");

  const { customer, invoice } = await searchParams;
  const [customers, products, settings, initialInvoices] = await Promise.all([
    listAllActiveCustomers(),
    listAllActiveProducts(),
    getCompanySettings(),
    customer ? getCustomerInvoicesForCreditNote(customer) : Promise.resolve(undefined),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Credit Note</h1>
        <p className="text-muted-foreground">Issue a credit to a customer&apos;s account.</p>
      </div>
      <CreditNoteForm
        customers={customers}
        products={products}
        defaultVatRate={settings.default_vat_rate}
        defaultCurrency={settings.default_currency}
        defaultTerms={settings.default_invoice_footer}
        initialCustomerId={customer}
        initialInvoiceId={invoice}
        initialInvoices={initialInvoices}
      />
    </div>
  );
}
