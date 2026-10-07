import type { Metadata } from "next";
import { getPublicCompanySettings } from "@/lib/config/system-settings";
import { ClientLoginForm } from "@/components/client/client-login-form";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CLIENT_PORTAL_ENABLED } from "@/lib/config/defaults";

export const metadata: Metadata = { title: "Sign in" };

interface ClientLoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function ClientLoginPage({ searchParams }: ClientLoginPageProps) {
  const [settings, { error }] = await Promise.all([getPublicCompanySettings(), searchParams]);

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-muted/30 px-4">
      {settings.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, matches app/(auth)/layout.tsx's same case
        <img src={settings.logoUrl} alt="" className="max-h-16 max-w-[220px] object-contain" />
      ) : (
        <span className="text-lg font-semibold">{settings.companyName}</span>
      )}
      <div className="w-full max-w-sm space-y-4">
        {CLIENT_PORTAL_ENABLED ? (
          <>
            {error === "invalid" ? (
              <p className="text-center text-sm text-destructive">
                That sign-in link is invalid or has expired. Request a new one below.
              </p>
            ) : null}
            <ClientLoginForm />
          </>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Client sign-in isn&apos;t available yet</CardTitle>
              <CardDescription>
                Please contact {settings.companyName} if you need a copy of a quote or invoice.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
      </div>
    </div>
  );
}
