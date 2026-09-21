import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listAllActiveSuppliers } from "@/server/services/suppliers";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Log Expense" };

interface NewExpensePageProps {
  searchParams: Promise<{ supplier?: string }>;
}

export default async function NewExpensePage({ searchParams }: NewExpensePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "suppliers")) redirect("/dashboard");

  const { supplier } = await searchParams;
  const suppliers = await listAllActiveSuppliers();

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton fallbackHref="/expenses" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Log Expense</h1>
        <p className="text-muted-foreground">Record money spent with a supplier.</p>
      </div>
      <ExpenseForm suppliers={suppliers} initialSupplierId={supplier} />
    </div>
  );
}
