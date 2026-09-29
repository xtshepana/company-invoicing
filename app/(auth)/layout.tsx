import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/server/services/auth";
import { getPublicBranding } from "@/lib/config/system-settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const [profile, branding] = await Promise.all([getCurrentProfile(), getPublicBranding()]);
  if (profile) redirect("/dashboard");

  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-6 bg-muted/30 px-4">
      {branding.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset Next can optimize (matches components/settings/logo-upload-form.tsx's preview)
        <img src={branding.logoUrl} alt="" className="max-h-16 max-w-[220px] object-contain" />
      ) : null}
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
