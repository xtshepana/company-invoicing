import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listAllActiveCustomers } from "@/server/services/customers";
import { listAllActiveProducts } from "@/server/services/products";
import { getCompanySettings } from "@/lib/config/system-settings";
import { RecurringInvoiceForm } from "@/components/documents/recurring-invoice-form";

export const metadata: Metadata = { title: "New Recurring Invoice" };

interface NewRecurringInvoicePageProps {
  searchParams: Promise<{ customer?: string }>;
}

export default async function NewRecurringInvoicePage({ searchParams }: NewRecurringInvoicePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "recurring_invoices")) redirect("/dashboard");

  const { customer } = await searchParams;
  const [customers, products, settings] = await Promise.all([
    listAllActiveCustomers(),
    listAllActiveProducts(),
    getCompanySettings(),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Recurring Invoice</h1>
        <p className="text-muted-foreground">Set up a schedule to automatically bill a customer.</p>
      </div>
      <RecurringInvoiceForm
        customers={customers}
        products={products}
        defaultVatRate={settings.default_vat_rate}
        defaultCurrency={settings.default_currency}
        initialCustomerId={customer}
      />
    </div>
  );
}
