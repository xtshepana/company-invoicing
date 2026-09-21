import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Pencil, Receipt } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getSupplierById, getSupplierRecentExpenses } from "@/server/services/suppliers";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";
import { ArchiveSupplierButton } from "@/components/suppliers/archive-supplier-button";
import { BackButton } from "@/components/shared/back-button";

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: SupplierDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const supplier = await getSupplierById(id);
  return { title: supplier?.company_name ?? "Supplier" };
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right">{value || "—"}</span>
    </div>
  );
}

export default async function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "suppliers")) redirect("/dashboard");

  const { id } = await params;
  const [supplier, recentExpenses, settings] = await Promise.all([
    getSupplierById(id),
    getSupplierRecentExpenses(id),
    getCompanySettings(),
  ]);
  if (!supplier) notFound();

  const currency = settings.default_currency;

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/suppliers" />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{supplier.company_name}</h1>
            <Badge variant={supplier.is_active ? "default" : "secondary"}>
              {supplier.is_active ? "Active" : "Archived"}
            </Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href={`/expenses/new?supplier=${supplier.id}`} />} nativeButton={false}>
            <Receipt /> Log Expense
          </Button>
          <Button variant="outline" render={<Link href={`/suppliers/${supplier.id}/edit`} />} nativeButton={false}>
            <Pencil /> Edit
          </Button>
          <ArchiveSupplierButton supplierId={supplier.id} isActive={supplier.is_active} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Contact person" value={supplier.contact_person} />
            <DetailRow label="Email" value={supplier.email} />
            <DetailRow label="Phone" value={supplier.phone} />
            <DetailRow label="VAT number" value={supplier.vat_number} />
            <DetailRow label="Physical address" value={supplier.address_physical} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">{supplier.notes || "No notes."}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent expenses</CardTitle>
        </CardHeader>
        <CardContent>
          {recentExpenses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No expenses logged yet.</p>
          ) : (
            <ul className="divide-y">
              {recentExpenses.map((expense) => (
                <li key={expense.id} className="flex items-center justify-between py-2 text-sm">
                  <div>
                    <p>{expense.description}</p>
                    <p className="text-muted-foreground">
                      {new Date(expense.expenseDate).toLocaleDateString("en-ZA")}
                      {expense.category ? ` · ${expense.category}` : ""}
                    </p>
                  </div>
                  <span className="text-muted-foreground">{formatCurrency(expense.amount, currency)}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
