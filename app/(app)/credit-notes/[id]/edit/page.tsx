import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCreditNoteById, getCustomerInvoicesForCreditNote } from "@/server/services/credit-notes";
import { listAllActiveCustomers } from "@/server/services/customers";
import { listAllActiveProducts } from "@/server/services/products";
import { getCompanySettings } from "@/lib/config/system-settings";
import { CreditNoteForm } from "@/components/documents/credit-note-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Edit Credit Note" };

interface EditCreditNotePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCreditNotePage({ params }: EditCreditNotePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "invoices")) redirect("/dashboard");

  const { id } = await params;
  const creditNote = await getCreditNoteById(id);
  if (!creditNote) notFound();
  if (creditNote.status !== "draft") redirect(`/credit-notes/${id}`);

  const [customers, products, settings, initialInvoices] = await Promise.all([
    listAllActiveCustomers(),
    listAllActiveProducts(),
    getCompanySettings(),
    getCustomerInvoicesForCreditNote(creditNote.customer_id),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <BackButton fallbackHref={`/credit-notes/${id}`} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Credit Note</h1>
        <p className="text-muted-foreground">{creditNote.credit_note_number}</p>
      </div>
      <CreditNoteForm
        creditNote={creditNote}
        customers={customers}
        products={products}
        defaultVatRate={settings.default_vat_rate}
        defaultCurrency={settings.default_currency}
        defaultTerms={settings.default_invoice_footer}
        initialInvoices={initialInvoices}
        vatRegistered={settings.vat_registered}
      />
    </div>
  );
}
