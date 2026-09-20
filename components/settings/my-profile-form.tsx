"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateOwnProfileAction } from "@/server/actions/profile-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Profile } from "@/server/services/auth";

const initialState: ActionResult = {};

export function MyProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction, pending] = useActionState(updateOwnProfileAction, initialState);
  const lastState = useRef(state);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.success) toast.success("Profile saved.");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" defaultValue={profile.full_name} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" value={profile.email} disabled />
        <p className="text-xs text-muted-foreground">Contact an administrator to change your email address.</p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
