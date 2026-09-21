import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getSupplierById } from "@/server/services/suppliers";
import { SupplierForm } from "@/components/suppliers/supplier-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Edit Supplier" };

interface EditSupplierPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditSupplierPage({ params }: EditSupplierPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "suppliers")) redirect("/dashboard");

  const { id } = await params;
  const supplier = await getSupplierById(id);
  if (!supplier) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton fallbackHref={`/suppliers/${id}`} />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Supplier</h1>
        <p className="text-muted-foreground">{supplier.company_name}</p>
      </div>
      <SupplierForm supplier={supplier} />
    </div>
  );
}
