"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateBankDetailsAction } from "@/server/actions/company-settings-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { CompanySettings } from "@/lib/config/system-settings";

const initialState: ActionResult = {};

export function BankDetailsForm({ settings }: { settings: CompanySettings }) {
  const [state, formAction, pending] = useActionState(updateBankDetailsAction, initialState);
  const lastState = useRef(state);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.success) toast.success("Bank details saved.");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="bank_name">Bank name</Label>
          <Input id="bank_name" name="bank_name" defaultValue={settings.bank_name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank_account_name">Account name</Label>
          <Input id="bank_account_name" name="bank_account_name" defaultValue={settings.bank_account_name} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank_account_number">Account number</Label>
          <Input id="bank_account_number" name="bank_account_number" defaultValue={settings.bank_account_number} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank_branch_code">Branch code</Label>
          <Input id="bank_branch_code" name="bank_branch_code" defaultValue={settings.bank_branch_code} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bank_account_type">Account type</Label>
          <Input id="bank_account_type" name="bank_account_type" defaultValue={settings.bank_account_type} />
        </div>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save bank details"}
      </Button>
    </form>
  );
}
