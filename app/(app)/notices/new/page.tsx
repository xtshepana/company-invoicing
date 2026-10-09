import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/server/services/auth";
import { getNoticeCompany, listNoticeRecipients } from "@/server/services/notices";
import { NoticeComposer } from "@/components/notices/notice-composer";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "New notice" };

// Sending runs one email per customer a couple at a time, so a long list takes a while.
export const maxDuration = 60;

export default async function NewNoticePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner_admin") redirect("/dashboard");

  const [{ sendable, unreachable }, company] = await Promise.all([listNoticeRecipients(), getNoticeCompany()]);

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/notices" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New notice</h1>
        <p className="text-muted-foreground">Write it once and email it to the customers you choose.</p>
      </div>
      <NoticeComposer
        recipients={sendable}
        unreachable={unreachable}
        company={company}
        adminEmail={profile.email}
        sendToken={crypto.randomUUID()}
      />
    </div>
  );
}
