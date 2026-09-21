import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/server/services/auth";
import { MyProfileForm } from "@/components/settings/my-profile-form";
import { ChangePasswordForm } from "@/components/settings/change-password-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "My profile" };

export default async function MyProfilePage() {
  const profile = await requireUser();

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/dashboard" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My profile</h1>
        <p className="text-muted-foreground">Your personal account details.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <MyProfileForm key={profile.updated_at} profile={profile} />
        </CardContent>
      </Card>

      <Card id="change-password">
        <CardHeader>
          <CardTitle>Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  );
}
