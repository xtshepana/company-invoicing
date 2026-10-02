import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

interface LoginPageProps {
  searchParams: Promise<{ idle?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { idle } = await searchParams;

  return (
    <div className="space-y-4">
      {idle === "1" ? (
        <p className="text-center text-sm text-muted-foreground">
          You were signed out because you were inactive for a while. Sign in to continue.
        </p>
      ) : null}
      <LoginForm />
    </div>
  );
}
