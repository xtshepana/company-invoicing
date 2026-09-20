import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getQuoteById } from "@/server/services/quotes";
import { listAllActiveCustomers } from "@/server/services/customers";
import { listAllActiveProducts } from "@/server/services/products";
import { getCompanySettings } from "@/lib/config/system-settings";
import { QuoteForm } from "@/components/documents/quote-form";

export const metadata: Metadata = { title: "Edit Quote" };

interface EditQuotePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditQuotePage({ params }: EditQuotePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "quotes")) redirect("/dashboard");

  const { id } = await params;
  const quote = await getQuoteById(id);
  if (!quote) notFound();
  if (quote.converted_invoice_id) redirect(`/quotes/${id}`);

  const [customers, products, settings] = await Promise.all([
    listAllActiveCustomers(),
    listAllActiveProducts(),
    getCompanySettings(),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Quote</h1>
        <p className="text-muted-foreground">{quote.quote_number}</p>
      </div>
      <QuoteForm
        quote={quote}
        customers={customers}
        products={products}
        defaultVatRate={settings.default_vat_rate}
        defaultCurrency={settings.default_currency}
        defaultTerms={settings.default_quote_terms}
      />
    </div>
  );
}
