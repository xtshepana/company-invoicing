import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/server/services/auth";
import { getCompanySettings } from "@/lib/config/system-settings";
import { AppShell } from "@/components/layout/app-shell";
import { HEX_COLOR_PATTERN, readableTextColor } from "@/lib/color-utils";
import { maybeTriggerDailyCron } from "@/lib/cron-trigger";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Re-checked here even though proxy.ts already redirects unauthenticated
  // requests — the proxy is an optimistic edge check, not the authorization
  // boundary (see AGENTS.md / architecture rule 7).
  //
  // Fetched in parallel rather than one after the other - settings doesn't
  // depend on the profile value, and with the Supabase project in
  // eu-west-1, each round trip costs ~250ms measured from this app's
  // usual location, so running the two sequentially was adding a full
  // extra round trip's worth of latency to every single authenticated
  // page load for no reason.
  const [profile, settings] = await Promise.all([getCurrentProfile(), getCompanySettings()]);
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?deactivated=1");

  // Deliberately not awaited - see lib/cron-trigger.ts for why this rides
  // along on requests instead of a process-lifetime timer.
  maybeTriggerDailyCron();
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
