import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { CustomerForm } from "@/components/customers/customer-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Add Customer" };

export default async function NewCustomerPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "customers")) redirect("/dashboard");

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton fallbackHref="/customers" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Customer</h1>
        <p className="text-muted-foreground">Create a new customer record.</p>
      </div>
      <CustomerForm />
    </div>
  );
}
