"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface SelectableCustomer {
  id: string;
  company_name: string;
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
  const items = Object.fromEntries(customers.map((c) => [c.id, c.company_name]));

  return (
    <Select name="customer_id" value={value} onValueChange={(v) => v && onValueChange(v)} items={items}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose a customer" />
      </SelectTrigger>
      <SelectContent>
        {customers.map((customer) => (
          <SelectItem key={customer.id} value={customer.id}>
            {customer.company_name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
