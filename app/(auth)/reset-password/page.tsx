import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reset password" };

interface ResetPasswordPageProps {
  searchParams: Promise<{ code?: string }>;
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const { code } = await searchParams;

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return <ExpiredLinkNotice />;
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <ExpiredLinkNotice />;
  }

  return <ResetPasswordForm />;
}

function ExpiredLinkNotice() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Link expired</CardTitle>
        <CardDescription>
          This password reset link is invalid or has expired. Request a new one from the sign-in page.
        </CardDescription>
      </CardHeader>
      <CardContent />
    </Card>
  );
}
