import { redirect } from "next/navigation";
import Link from "next/link";
import { getClientSession } from "@/server/services/client-auth";
import { getPublicCompanySettings } from "@/lib/config/system-settings";
import { clientLogoutAction } from "@/server/actions/client-portal-actions";
import { Button } from "@/components/ui/button";

// Every page here depends on the visitor's session cookie, so none of it can
// be prerendered at build time - without this, a build where the session
// lookup short-circuits (e.g. the portal switched off) tries to prerender
// /client and fails on the signed-in check.
export const dynamic = "force-dynamic";

/**
 * Not covered by proxy.ts's PROTECTED_PREFIXES (that matcher is staff-only
 * - see CLAUDE.md architecture rule 7) - a customer isn't a Supabase Auth
 * user, so this layout does its own session check instead, same pattern
 * as every other protected route group's layout.
 */
export default async function ClientPortalLayout({ children }: { children: React.ReactNode }) {
  const [session, settings] = await Promise.all([getClientSession(), getPublicCompanySettings()]);
  if (!session) redirect("/client/login");

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="flex items-center justify-between border-b bg-background px-6 py-4">
        <Link href="/client" className="font-semibold">
          {settings.companyName}
        </Link>
        <form action={clientLogoutAction}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
