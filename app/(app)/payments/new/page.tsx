import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listAllActiveCustomers } from "@/server/services/customers";
import { getCustomerOutstandingInvoices } from "@/server/services/payments";
import { getCompanySettings } from "@/lib/config/system-settings";
import { PaymentForm } from "@/components/payments/payment-form";

export const metadata: Metadata = { title: "Record Payment" };

interface NewPaymentPageProps {
  searchParams: Promise<{
    customer?: string;
    bank_transaction_id?: string;
    amount?: string;
    date?: string;
    reference?: string;
    description?: string;
  }>;
}

export default async function NewPaymentPage({ searchParams }: NewPaymentPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "payments")) redirect("/dashboard");

  const { customer, bank_transaction_id, amount, date, reference, description } = await searchParams;
  if (bank_transaction_id && !hasModuleAccess(profile, "banking")) redirect("/dashboard");

  const [customers, settings, initialInvoices] = await Promise.all([
    listAllActiveCustomers(),
    getCompanySettings(),
    customer ? getCustomerOutstandingInvoices(customer) : Promise.resolve(undefined),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Record Payment</h1>
        <p className="text-muted-foreground">
          {bank_transaction_id
            ? "Creating a payment from an unreconciled bank transaction — choose the customer and allocate it."
            : "Record a payment received from a customer and allocate it."}
        </p>
      </div>
      <PaymentForm
        customers={customers}
        currency={settings.default_currency}
        initialCustomerId={customer}
        initialInvoices={initialInvoices}
        bankTransactionId={bank_transaction_id}
        initialAmount={amount ? Number(amount) : undefined}
        initialDate={date}
        initialReference={reference}
        initialDescription={description}
      />
    </div>
  );
}
