import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentProfile } from "@/server/services/auth";
import { getCompanySettings } from "@/lib/config/system-settings";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
import { LogoUploadForm } from "@/components/settings/logo-upload-form";
import { AppearanceForm } from "@/components/settings/appearance-form";
import { BankDetailsForm } from "@/components/settings/bank-details-form";
import { InvoiceSettingsForm } from "@/components/settings/invoice-settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner_admin") redirect("/dashboard");

  const settings = await getCompanySettings();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Company profile, VAT, invoice numbering, and bank details.</p>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="invoicing">VAT &amp; invoicing</TabsTrigger>
          <TabsTrigger value="bank">Bank details</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <LogoUploadForm key={settings.logo_url} logoUrl={settings.logo_url} />
              <CompanyProfileForm key={settings.updated_at} settings={settings} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>Pick a brand color and document template for the app and your documents.</CardDescription>
            </CardHeader>
            <CardContent>
              <AppearanceForm
                key={`${settings.brand_color}-${settings.pdf_template}`}
                brandColor={settings.brand_color}
                pdfTemplate={settings.pdf_template}
              />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="invoicing">
          <Card>
            <CardHeader>
              <CardTitle>VAT &amp; invoicing</CardTitle>
            </CardHeader>
            <CardContent>
              <InvoiceSettingsForm key={settings.updated_at} settings={settings} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="bank">
          <Card>
            <CardHeader>
              <CardTitle>Bank details</CardTitle>
            </CardHeader>
            <CardContent>
              <BankDetailsForm key={settings.updated_at} settings={settings} />
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle>Backup</CardTitle>
              <CardDescription>
                Download every record in the system — customers, products, quotes, invoices, payments, credit
                notes, recurring invoices, bank reconciliation data, and audit/email logs — as a single JSON file.
                This is export-only: there is no automated way to restore from it, so keep it somewhere safe rather
                than treating the download itself as a backup strategy.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button render={<a href="/api/admin/export" />} nativeButton={false}>
                <Download /> Export All Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
