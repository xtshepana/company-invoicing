"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { updateCompanyProfileAction } from "@/server/actions/company-settings-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { CompanySettings } from "@/lib/config/system-settings";
import { toast } from "sonner";
import { useEffect, useRef } from "react";

const initialState: ActionResult = {};

export function CompanyProfileForm({ settings }: { settings: CompanySettings }) {
  const [state, formAction, pending] = useActionState(updateCompanyProfileAction, initialState);
  const lastState = useRef(state);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.success) toast.success("Company profile saved.");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="company_name">Company name</Label>
          <Input id="company_name" name="company_name" defaultValue={settings.company_name} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="trading_name">Trading name</Label>
          <Input id="trading_name" name="trading_name" defaultValue={settings.trading_name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="registration_number">Registration number</Label>
          <Input id="registration_number" name="registration_number" defaultValue={settings.registration_number} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vat_number">VAT number</Label>
          <Input id="vat_number" name="vat_number" defaultValue={settings.vat_number} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" name="phone" defaultValue={settings.phone} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" defaultValue={settings.email} />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="website">Website</Label>
          <Input id="website" name="website" defaultValue={settings.website} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_physical">Physical address</Label>
          <Textarea id="address_physical" name="address_physical" defaultValue={settings.address_physical} rows={3} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="address_postal">Postal address</Label>
          <Textarea id="address_postal" name="address_postal" defaultValue={settings.address_postal} rows={3} />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save company profile"}
      </Button>
    </form>
  );
}
