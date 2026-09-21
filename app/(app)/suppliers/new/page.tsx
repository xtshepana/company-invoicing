import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Add Supplier" };

export default async function NewSupplierPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "suppliers")) redirect("/dashboard");

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton fallbackHref="/suppliers" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Supplier</h1>
        <p className="text-muted-foreground">Create a new supplier record.</p>
      </div>
      <SupplierForm />
    </div>
  );
}
