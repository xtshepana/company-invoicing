import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCustomerById } from "@/server/services/customers";
import { CustomerForm } from "@/components/customers/customer-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Edit Customer" };

interface EditCustomerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCustomerPage({ params }: EditCustomerPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "customers")) redirect("/dashboard");

  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton fallbackHref={`/customers/${id}`} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Customer</h1>
        <p className="text-muted-foreground">{customer.company_name}</p>
      </div>
      <CustomerForm customer={customer} />
    </div>
  );
}
