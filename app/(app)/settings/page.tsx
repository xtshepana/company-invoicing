import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getCurrentProfile } from "@/server/services/auth";
import { getCompanySettings } from "@/lib/config/system-settings";
import { CompanyProfileForm } from "@/components/settings/company-profile-form";
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
          <TabsTrigger value="invoicing">VAT &amp; invoicing</TabsTrigger>
          <TabsTrigger value="bank">Bank details</TabsTrigger>
        </TabsList>
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Company profile</CardTitle>
            </CardHeader>
            <CardContent>
              <CompanyProfileForm key={settings.updated_at} settings={settings} />
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
      </Tabs>
    </div>
  );
}
