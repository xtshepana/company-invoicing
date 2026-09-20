import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/server/services/auth";
import { getCompanySettings } from "@/lib/config/system-settings";
import { AppShell } from "@/components/layout/app-shell";
import { HEX_COLOR_PATTERN, readableTextColor } from "@/lib/color-utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Re-checked here even though proxy.ts already redirects unauthenticated
  // requests — the proxy is an optimistic edge check, not the authorization
  // boundary (see AGENTS.md / architecture rule 7).
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?deactivated=1");

  const settings = await getCompanySettings();
  // brand_color is validated as a hex string at write time (appearanceSchema),
  // but re-checked here since it's about to be interpolated into raw CSS.
  const brandColor =
    settings.brand_color && HEX_COLOR_PATTERN.test(settings.brand_color) ? settings.brand_color : null;

  return (
    <>
      {brandColor ? (
        <style>{`
          :root, .dark {
            --primary: ${brandColor};
            --primary-foreground: ${readableTextColor(brandColor)};
            --ring: ${brandColor};
            --sidebar-primary: ${brandColor};
            --sidebar-primary-foreground: ${readableTextColor(brandColor)};
            --sidebar-ring: ${brandColor};
          }
        `}</style>
      ) : null}
      <AppShell profile={profile} companyName={settings.company_name}>
        {children}
      </AppShell>
    </>
  );
}
