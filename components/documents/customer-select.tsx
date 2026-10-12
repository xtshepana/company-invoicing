"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { customerOptionLabel } from "@/lib/customers/account-number";

export interface SelectableCustomer {
  id: string;
  company_name: string;
  customer_reference?: string | null;
}

export function CustomerSelect({
  customers,
  value,
  onValueChange,
  id,
}: {
  customers: SelectableCustomer[];
  value: string | null;
  onValueChange: (value: string) => void;
  id?: string;
}) {
  const items = Object.fromEntries(customers.map((c) => [c.id, customerOptionLabel(c)]));

  return (
    <Select name="customer_id" value={value} onValueChange={(v) => v && onValueChange(v)} items={items}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose a customer" />
      </SelectTrigger>
      <SelectContent>
        {customers.map((customer) => (
          <SelectItem key={customer.id} value={customer.id}>
            {customerOptionLabel(customer)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
