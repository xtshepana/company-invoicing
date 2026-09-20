import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/server/services/auth";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (profile) redirect("/dashboard");

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
