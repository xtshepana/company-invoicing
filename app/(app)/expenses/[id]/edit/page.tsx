import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { getExpenseById } from "@/server/services/expenses";
import { listAllActiveSuppliers } from "@/server/services/suppliers";
import { ExpenseForm } from "@/components/expenses/expense-form";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Edit Expense" };

interface EditExpensePageProps {
  params: Promise<{ id: string }>;
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "suppliers")) redirect("/dashboard");

  const { id } = await params;
  const [expense, suppliers] = await Promise.all([getExpenseById(id), listAllActiveSuppliers()]);
  if (!expense) notFound();

  return (
    <div className="max-w-3xl space-y-6">
      <BackButton fallbackHref="/expenses" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Expense</h1>
        <p className="text-muted-foreground">{expense.description}</p>
      </div>
      <ExpenseForm expense={expense} suppliers={suppliers} />
    </div>
  );
}
