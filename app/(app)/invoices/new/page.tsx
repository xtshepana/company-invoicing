import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listAllActiveCustomers } from "@/server/services/customers";
import { listAllActiveProducts } from "@/server/services/products";
import { getCompanySettings } from "@/lib/config/system-settings";
import { InvoiceForm } from "@/components/documents/invoice-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "New Invoice" };

interface NewInvoicePageProps {
  searchParams: Promise<{ customer?: string }>;
}

export default async function NewInvoicePage({ searchParams }: NewInvoicePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "invoices")) redirect("/dashboard");

  const { customer } = await searchParams;
  const [customers, products, settings] = await Promise.all([
    listAllActiveCustomers(),
    listAllActiveProducts(),
    getCompanySettings(),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <BackButton fallbackHref="/invoices" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Invoice</h1>
        <p className="text-muted-foreground">Bill a customer.</p>
      </div>
      <InvoiceForm
        customers={customers}
        products={products}
        defaultVatRate={settings.default_vat_rate}
        defaultCurrency={settings.default_currency}
        defaultTerms={settings.default_invoice_footer}
        defaultPaymentTermsDays={settings.default_payment_terms_days}
        initialCustomerId={customer}
        vatRegistered={settings.vat_registered}
      />
    </div>
  );
}
