import type { Metadata } from "next";
import { getPublicCompanySettings } from "@/lib/config/system-settings";
import { ClientLoginForm } from "@/components/client/client-login-form";

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
        {error === "invalid" ? (
          <p className="text-center text-sm text-destructive">
            That sign-in link is invalid or has expired. Request a new one below.
          </p>
        ) : null}
        <ClientLoginForm />
      </div>
    </div>
  );
}
