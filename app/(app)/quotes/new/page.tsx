import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listAllActiveCustomers } from "@/server/services/customers";
import { listAllActiveProducts } from "@/server/services/products";
import { getCompanySettings } from "@/lib/config/system-settings";
import { QuoteForm } from "@/components/documents/quote-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "New Quote" };

interface NewQuotePageProps {
  searchParams: Promise<{ customer?: string }>;
}

export default async function NewQuotePage({ searchParams }: NewQuotePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "quotes")) redirect("/dashboard");

  const { customer } = await searchParams;
  const [customers, products, settings] = await Promise.all([
    listAllActiveCustomers(),
    listAllActiveProducts(),
    getCompanySettings(),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <BackButton fallbackHref="/quotes" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Quote</h1>
        <p className="text-muted-foreground">Create a quotation for a customer.</p>
      </div>
      <QuoteForm
        customers={customers}
        products={products}
        defaultVatRate={settings.default_vat_rate}
        defaultCurrency={settings.default_currency}
        defaultTerms={settings.default_quote_terms}
        initialCustomerId={customer}
      />
    </div>
  );
}
