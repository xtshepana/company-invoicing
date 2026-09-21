"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createSupplierAction, updateSupplierAction } from "@/server/actions/supplier-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Supplier } from "@/server/services/suppliers";

const initialState: ActionResult = {};

export function SupplierForm({ supplier }: { supplier?: Supplier }) {
  const action = supplier ? updateSupplierAction : createSupplierAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-6">
      {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Supplier details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="company_name">Company name</Label>
            <Input id="company_name" name="company_name" defaultValue={supplier?.company_name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact person</Label>
            <Input id="contact_person" name="contact_person" defaultValue={supplier?.contact_person} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vat_number">VAT number</Label>
            <Input id="vat_number" name="vat_number" defaultValue={supplier?.vat_number} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={supplier?.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={supplier?.phone} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address_physical">Physical address</Label>
            <Textarea id="address_physical" name="address_physical" defaultValue={supplier?.address_physical} rows={3} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={supplier?.notes} rows={3} />
          </div>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : supplier ? "Save changes" : "Add supplier"}
      </Button>
    </form>
  );
}
