import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listRecurringInvoices } from "@/server/services/recurring-invoices";
import { recurringInvoiceSearchSchema, RECURRING_FREQUENCY_LABELS } from "@/lib/validations/recurring-invoices";

export const metadata: Metadata = { title: "Recurring Invoices" };

const STATUS_LABELS: Record<string, string> = { active: "Active", paused: "Paused", cancelled: "Cancelled" };
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive"> = {
  active: "default",
  paused: "secondary",
  cancelled: "destructive",
};

interface RecurringInvoicesPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function RecurringInvoicesPage({ searchParams }: RecurringInvoicesPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "recurring_invoices")) redirect("/dashboard");

  const params = recurringInvoiceSearchSchema.parse(await searchParams);
  const result = await listRecurringInvoices(params);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status !== "active") sp.set("status", params.status);
    sp.set("page", String(page));
    return `/recurring-invoices?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Recurring Invoices</h1>
          <p className="text-muted-foreground">Bill customers automatically on a schedule.</p>
        </div>
        <Button render={<Link href="/recurring-invoices/new" />} nativeButton={false}>
          <Plus /> New Recurring Invoice
        </Button>
      </div>

      <ListFilters
        searchValue={params.q}
        searchPlaceholder="Search by description…"
        selects={[
          {
            param: "status",
            value: params.status,
            options: [
              { value: "active", label: "Active" },
              { value: "paused", label: "Paused" },
              { value: "cancelled", label: "Cancelled" },
              { value: "all", label: "All" },
            ],
          },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Repeat className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q || params.status !== "active"
                  ? "No recurring invoices match your filters."
                  : "No recurring invoices configured."}
              </p>
              {!params.q && params.status === "active" ? (
                <Button size="sm" render={<Link href="/recurring-invoices/new" />} nativeButton={false}>
                  <Plus /> New Recurring Invoice
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Next invoice</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((recurring) => (
                  <TableRow key={recurring.id}>
                    <TableCell className="font-medium">
                      <Link href={`/recurring-invoices/${recurring.id}`} className="hover:underline">
                        {recurring.description}
                      </Link>
                    </TableCell>
                    <TableCell>{recurring.customers?.company_name ?? "—"}</TableCell>
                    <TableCell>{RECURRING_FREQUENCY_LABELS[recurring.frequency]}</TableCell>
                    <TableCell>{new Date(recurring.next_invoice_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[recurring.status]}>{STATUS_LABELS[recurring.status]}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationBar page={result.page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
