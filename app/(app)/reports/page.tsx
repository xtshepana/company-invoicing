import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Percent, Clock } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "reports")) redirect("/dashboard");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground">VAT and accounts-receivable reporting.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/reports/vat">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardHeader>
              <Percent className="h-6 w-6 text-muted-foreground" />
              <CardTitle>VAT Report</CardTitle>
              <CardDescription>
                Output VAT collected on sales for a chosen period, net of VAT reversed by credit notes.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
        <Link href="/reports/aging">
          <Card className="h-full transition-colors hover:bg-accent/50">
            <CardHeader>
              <Clock className="h-6 w-6 text-muted-foreground" />
              <CardTitle>Accounts Receivable Aging</CardTitle>
              <CardDescription>Outstanding invoice balances by customer, bucketed by days overdue.</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  );
}
