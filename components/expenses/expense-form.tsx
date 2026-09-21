"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createExpenseAction, updateExpenseAction } from "@/server/actions/expense-actions";
import { EXPENSE_CATEGORIES } from "@/lib/validations/suppliers";
import type { ActionResult } from "@/server/actions/auth-actions";
import type { Expense } from "@/server/services/expenses";

const initialState: ActionResult = {};
const NO_SUPPLIER = "__none__";

export function ExpenseForm({
  expense,
  suppliers,
  initialSupplierId,
}: {
  expense?: Expense;
  suppliers: { id: string; company_name: string }[];
  /** Preselects the supplier when creating a new expense from a supplier's own page (e.g. ?supplier=...). Ignored when editing an existing expense. */
  initialSupplierId?: string;
}) {
  const action = expense ? updateExpenseAction : createExpenseAction;
  const [state, formAction, pending] = useActionState(action, initialState);
  const [supplierId, setSupplierId] = useState(expense?.supplier_id ?? initialSupplierId ?? NO_SUPPLIER);
  const [category, setCategory] = useState(expense?.category ?? "");

  // Passed as `items` (a value->label map) rather than left to SelectItem's
  // own dynamic registration - Base UI's SelectValue only resolves a label
  // for a value set programmatically (as opposed to picked by the user)
  // via this items map or an explicit children render-prop; otherwise it
  // falls back to showing the raw value, which is exactly what happened
  // here when preselecting a supplier from ?supplier=... in the URL.
  const supplierItems: Record<string, string> = { [NO_SUPPLIER]: "No supplier" };
  for (const s of suppliers) supplierItems[s.id] = s.company_name;
  const categoryItems: Record<string, string> = Object.fromEntries(EXPENSE_CATEGORIES.map((c) => [c, c]));

  return (
    <form action={formAction} className="space-y-6">
      {expense ? <input type="hidden" name="id" value={expense.id} /> : null}
      <input type="hidden" name="supplier_id" value={supplierId === NO_SUPPLIER ? "" : supplierId} />
      <input type="hidden" name="category" value={category} />

      <Card>
        <CardHeader>
          <CardTitle>Expense details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Input id="description" name="description" defaultValue={expense?.description} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expense_date">Date</Label>
            <Input
              id="expense_date"
              name="expense_date"
              type="date"
              defaultValue={expense?.expense_date ?? new Date().toISOString().slice(0, 10)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" name="amount" type="number" step="0.01" min={0} defaultValue={expense?.amount} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="category_select">Category</Label>
            <Select value={category} onValueChange={(value) => value && setCategory(value)} items={categoryItems}>
              <SelectTrigger id="category_select" className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {EXPENSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="supplier_select">Supplier</Label>
            <Select value={supplierId} onValueChange={(value) => value && setSupplierId(value)} items={supplierItems}>
              <SelectTrigger id="supplier_select" className="w-full">
                <SelectValue placeholder="No supplier" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_SUPPLIER}>No supplier</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.company_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={expense?.notes} rows={3} />
          </div>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : expense ? "Save changes" : "Add expense"}
      </Button>
    </form>
  );
}
