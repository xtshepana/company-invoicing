import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getCompanySettings } from "@/lib/config/system-settings";
import { ImportWizard } from "@/components/bank/import-wizard";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Import Bank Statement" };

export default async function ImportBankStatementPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "banking")) redirect("/dashboard");

  const settings = await getCompanySettings();

  return (
    <div className="max-w-4xl space-y-6">
      <BackButton fallbackHref="/bank-reconciliation" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Import Bank Statement</h1>
        <p className="text-muted-foreground">Upload a CSV or Excel export and map its columns.</p>
      </div>
      <ImportWizard currency={settings.default_currency} />
    </div>
  );
}
