"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createCustomerAction, updateCustomerAction } from "@/server/actions/customer-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Customer } from "@/server/services/customers";

const initialState: ActionResult = {};

export function CustomerForm({ customer }: { customer?: Customer }) {
  const action = customer ? updateCustomerAction : createCustomerAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [customerType, setCustomerType] = useState(customer?.customer_type ?? "business");

  return (
    <form action={formAction} className="space-y-6">
      {customer ? <input type="hidden" name="id" value={customer.id} /> : null}

      <Card>
        <CardHeader>
          <CardTitle>Customer details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="customer_type">Customer type</Label>
            <Select
              name="customer_type"
              value={customerType}
              onValueChange={(value) => value && setCustomerType(value as Customer["customer_type"])}
              items={{ business: "Business", individual: "Individual" }}
            >
              <SelectTrigger id="customer_type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="business">Business</SelectItem>
                <SelectItem value="individual">Individual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="company_name">{customerType === "business" ? "Company name" : "Full name"}</Label>
            <Input id="company_name" name="company_name" defaultValue={customer?.company_name} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_person">Contact person</Label>
            <Input id="contact_person" name="contact_person" defaultValue={customer?.contact_person} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="customer_reference">Customer reference</Label>
            <Input
              id="customer_reference"
              name="customer_reference"
              defaultValue={customer?.customer_reference}
              placeholder="Leave blank to auto-generate"
            />
            <p className="text-xs text-muted-foreground">
              Leave blank to auto-generate a unique one from the company name.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={customer?.email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={customer?.phone} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile</Label>
            <Input id="mobile" name="mobile" defaultValue={customer?.mobile} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vat_number">VAT number</Label>
            <Input id="vat_number" name="vat_number" defaultValue={customer?.vat_number} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="registration_number">Registration number</Label>
            <Input id="registration_number" name="registration_number" defaultValue={customer?.registration_number} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_physical">Physical address</Label>
            <Textarea id="address_physical" name="address_physical" defaultValue={customer?.address_physical} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address_postal">Postal address</Label>
            <Textarea id="address_postal" name="address_postal" defaultValue={customer?.address_postal} rows={3} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="payment_terms_days">Payment terms (days)</Label>
            <Input
              id="payment_terms_days"
              name="payment_terms_days"
              type="number"
              min={0}
              placeholder="Use company default"
              defaultValue={customer?.payment_terms_days ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="opening_balance">Opening balance</Label>
            <Input
              id="opening_balance"
              name="opening_balance"
              type="number"
              step="0.01"
              defaultValue={customer?.opening_balance ?? 0}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={customer?.notes} rows={3} />
          </div>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : customer ? "Save changes" : "Add customer"}
      </Button>
    </form>
  );
}
