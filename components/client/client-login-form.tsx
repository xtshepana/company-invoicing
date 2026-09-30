"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requestClientLoginAction } from "@/server/actions/client-portal-actions";
import type { ActionResult } from "@/server/actions/auth-actions";

const initialState: ActionResult = {};

export function ClientLoginForm() {
  const [state, formAction, pending] = useActionState(requestClientLoginAction, initialState);

  if (state.success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If that email is on a customer account, a sign-in link is on its way. It expires in 15 minutes.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sign in to your account</CardTitle>
        <CardDescription>We&apos;ll email you a link — no password needed.</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Sending…" : "Send sign-in link"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
