"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { updateInvoiceSettingsAction } from "@/server/actions/company-settings-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { CompanySettings } from "@/lib/config/system-settings";

const initialState: ActionResult = {};

export function InvoiceSettingsForm({ settings }: { settings: CompanySettings }) {
  const [state, formAction, pending] = useActionState(updateInvoiceSettingsAction, initialState);
  const lastState = useRef(state);
  const [pricesIncludeVat, setPricesIncludeVat] = useState(settings.default_prices_include_vat);
  const [remindersEnabled, setRemindersEnabled] = useState(settings.payment_reminders_enabled);
  const [dueAtMonthEnd, setDueAtMonthEnd] = useState(settings.recurring_due_at_month_end);
  const [vatRegistered, setVatRegistered] = useState(settings.vat_registered);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.success) toast.success("Invoice settings saved.");
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction} className="space-y-4">
      <div className="flex items-center gap-3 rounded-md border p-3">
        <Switch id="vat_registered" name="vat_registered" checked={vatRegistered} onCheckedChange={setVatRegistered} />
        <div>
          <Label htmlFor="vat_registered">VAT registered</Label>
          <p className="text-xs text-muted-foreground">
            {vatRegistered
              ? "VAT is applied to new invoices, quotes, and credit notes using the rate below."
              : "Off means every new document is created at 0% VAT, regardless of any product's configured rate — turn this on once your VAT registration comes through."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invoice_prefix">Invoice prefix</Label>
          <Input id="invoice_prefix" name="invoice_prefix" defaultValue={settings.invoice_prefix} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoice_next_number">Next invoice number</Label>
          <Input
            id="invoice_next_number"
            name="invoice_next_number"
            type="number"
            min={1}
            defaultValue={settings.invoice_next_number}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote_prefix">Quote prefix</Label>
          <Input id="quote_prefix" name="quote_prefix" defaultValue={settings.quote_prefix} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quote_next_number">Next quote number</Label>
          <Input
            id="quote_next_number"
            name="quote_next_number"
            type="number"
            min={1}
            defaultValue={settings.quote_next_number}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="credit_note_prefix">Credit note prefix</Label>
          <Input id="credit_note_prefix" name="credit_note_prefix" defaultValue={settings.credit_note_prefix} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="credit_note_next_number">Next credit note number</Label>
          <Input
            id="credit_note_next_number"
            name="credit_note_next_number"
            type="number"
            min={1}
            defaultValue={settings.credit_note_next_number}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="default_payment_terms_days">Default payment terms (days)</Label>
          <Input
            id="default_payment_terms_days"
            name="default_payment_terms_days"
            type="number"
            min={0}
            defaultValue={settings.default_payment_terms_days}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="recurring_billing_day">Recurring billing day</Label>
          <Input
            id="recurring_billing_day"
            name="recurring_billing_day"
            type="number"
            min={1}
            max={28}
            defaultValue={settings.recurring_billing_day ?? ""}
            placeholder="e.g. 26"
          />
          <p className="text-xs text-muted-foreground">
            Every monthly recurring invoice is created on this day of the month (1 to 28). A new recurring invoice
            starts on it, and each one moves onto it after its next invoice is created. Leave blank for no fixed day.
          </p>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id="recurring_due_at_month_end"
            name="recurring_due_at_month_end"
            checked={dueAtMonthEnd}
            onCheckedChange={setDueAtMonthEnd}
          />
          <Label htmlFor="recurring_due_at_month_end">Recurring invoices fall due on the last day of the month</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="default_vat_rate">Default VAT rate (%)</Label>
          <Input
            id="default_vat_rate"
            name="default_vat_rate"
            type="number"
            step="0.01"
            min={0}
            max={100}
            defaultValue={settings.default_vat_rate}
            required
          />
          {!vatRegistered ? (
            <p className="text-xs text-muted-foreground">Not used until VAT registered is turned on above.</p>
          ) : null}
        </div>
        <div className="space-y-2">
          <Label htmlFor="default_currency">Default currency (ISO code)</Label>
          <Input
            id="default_currency"
            name="default_currency"
            defaultValue={settings.default_currency}
            maxLength={3}
            required
          />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id="default_prices_include_vat"
            name="default_prices_include_vat"
            checked={pricesIncludeVat}
            onCheckedChange={setPricesIncludeVat}
          />
          <Label htmlFor="default_prices_include_vat">Prices entered include VAT by default</Label>
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch
            id="payment_reminders_enabled"
            name="payment_reminders_enabled"
            checked={remindersEnabled}
            onCheckedChange={setRemindersEnabled}
          />
          <Label htmlFor="payment_reminders_enabled">Send payment reminders</Label>
        </div>
        <div className="space-y-2">
          <Label htmlFor="reminder_review_email">Reminder review email</Label>
          <Input
            id="reminder_review_email"
            name="reminder_review_email"
            type="email"
            defaultValue={settings.reminder_review_email ?? ""}
            placeholder="you@yourcompany.co.za"
          />
          <p className="text-xs text-muted-foreground">
            Customers with an unpaid, overdue invoice are emailed a reminder on the last day of every month and a
            final one on the 5th. This address gets a summary of who was reminded, and on the 7th one list of every
            account still unpaid, to review for blocking. Left blank, customers are still reminded but no summary or
            list is sent (the list falls back to the accounts email below).
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="accounts_notification_email">Accounts notification email</Label>
          <Input
            id="accounts_notification_email"
            name="accounts_notification_email"
            type="email"
            defaultValue={settings.accounts_notification_email ?? ""}
            placeholder="accounts@yourcompany.co.za"
          />
          <p className="text-xs text-muted-foreground">
            Gets a copy (CC) of every invoice, quote, credit note, receipt and payment reminder sent to a
            customer. Left blank, no copies are sent.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="default_invoice_notes">Default invoice notes</Label>
        <Textarea id="default_invoice_notes" name="default_invoice_notes" defaultValue={settings.default_invoice_notes} rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="default_invoice_footer">Default invoice footer</Label>
        <Textarea id="default_invoice_footer" name="default_invoice_footer" defaultValue={settings.default_invoice_footer} rows={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="default_quote_terms">Default quote terms</Label>
        <Textarea id="default_quote_terms" name="default_quote_terms" defaultValue={settings.default_quote_terms} rows={3} />
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save invoice settings"}
      </Button>
    </form>
  );
}
