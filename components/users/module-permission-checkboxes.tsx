"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { STAFF_MODULES } from "@/lib/validations/users";

const MODULE_LABELS: Record<(typeof STAFF_MODULES)[number], string> = {
  customers: "Customers",
  products: "Products & Services",
  quotes: "Quotes",
  invoices: "Invoices",
  recurring_invoices: "Recurring Invoices",
  payments: "Payments",
  banking: "Banking",
  reports: "Reports",
  suppliers: "Suppliers & Expenses",
};

export function ModulePermissionCheckboxes({
  initialPermissions,
  fieldName = "staff_module_permissions",
}: {
  initialPermissions?: Record<string, boolean>;
  fieldName?: string;
}) {
  const [permissions, setPermissions] = useState<Record<string, boolean>>(initialPermissions ?? {});

  return (
    <div className="space-y-2">
      <Label>Module access</Label>
      <input type="hidden" name={fieldName} value={JSON.stringify(permissions)} />
      <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
        {STAFF_MODULES.map((module) => (
          <div key={module} className="flex items-center gap-2">
            <Checkbox
              id={`module-${module}-${fieldName}`}
              checked={Boolean(permissions[module])}
              onCheckedChange={(checked) =>
                setPermissions((prev) => ({ ...prev, [module]: checked === true }))
              }
            />
            <Label htmlFor={`module-${module}-${fieldName}`} className="text-sm font-normal">
              {MODULE_LABELS[module]}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
