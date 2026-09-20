import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/server/services/auth";
import { getCompanySettings } from "@/lib/config/system-settings";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Re-checked here even though proxy.ts already redirects unauthenticated
  // requests — the proxy is an optimistic edge check, not the authorization
  // boundary (see AGENTS.md / architecture rule 7).
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!profile.is_active) redirect("/login?deactivated=1");

  const settings = await getCompanySettings();

  return (
    <AppShell profile={profile} companyName={settings.company_name}>
      {children}
    </AppShell>
  );
}
