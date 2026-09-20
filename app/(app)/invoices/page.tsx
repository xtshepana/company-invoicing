import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listInvoices } from "@/server/services/invoices";
import { invoiceSearchSchema } from "@/lib/validations/invoices";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";

export const metadata: Metadata = { title: "Invoices" };

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  partially_paid: "Partially Paid",
  paid: "Paid",
  cancelled: "Cancelled",
  void: "Void",
};

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "outline",
  partially_paid: "outline",
  paid: "default",
  cancelled: "destructive",
  void: "destructive",
};

interface InvoicesPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

function isOverdue(dueDate: string, balanceDue: number, status: string): boolean {
  const today = new Date().toISOString().slice(0, 10);
  return status !== "cancelled" && status !== "void" && balanceDue > 0 && dueDate < today;
}

export default async function InvoicesPage({ searchParams }: InvoicesPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "invoices")) redirect("/dashboard");

  const params = invoiceSearchSchema.parse(await searchParams);
  const [result, settings] = await Promise.all([listInvoices(params), getCompanySettings()]);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status !== "all") sp.set("status", params.status);
    sp.set("page", String(page));
    return `/invoices?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">Bill your customers and track what&apos;s owed.</p>
        </div>
        <Button render={<Link href="/invoices/new" />} nativeButton={false}>
          <Plus /> New Invoice
        </Button>
      </div>

      <ListFilters
        searchValue={params.q}
        searchPlaceholder="Search by invoice number or reference…"
        selects={[
          {
            param: "status",
            value: params.status,
            options: [
              { value: "all", label: "All statuses" },
              { value: "overdue", label: "Overdue" },
              ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label })),
            ],
          },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Receipt className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q || params.status !== "all" ? "No invoices match your filters." : "No invoices found."}
              </p>
              {!params.q && params.status === "all" ? (
                <Button size="sm" render={<Link href="/invoices/new" />} nativeButton={false}>
                  <Plus /> New Invoice
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Due date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Balance due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((invoice) => {
                  const overdue = isOverdue(invoice.due_date, invoice.balance_due ?? 0, invoice.status);
                  return (
                    <TableRow key={invoice.id}>
                      <TableCell className="font-medium">
                        <Link href={`/invoices/${invoice.id}`} className="hover:underline">
                          {invoice.invoice_number}
                        </Link>
                      </TableCell>
                      <TableCell>{invoice.customers?.company_name ?? "—"}</TableCell>
                      <TableCell>{new Date(invoice.due_date).toLocaleDateString("en-ZA")}</TableCell>
                      <TableCell>{formatCurrency(invoice.total, settings.default_currency)}</TableCell>
                      <TableCell>{formatCurrency(invoice.balance_due ?? 0, settings.default_currency)}</TableCell>
                      <TableCell>
                        {overdue ? (
                          <Badge variant="destructive">Overdue</Badge>
                        ) : (
                          <Badge variant={STATUS_VARIANTS[invoice.status]}>{STATUS_LABELS[invoice.status]}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationBar page={result.page} totalPages={totalPages} buildHref={buildHref} />
    </div>
  );
}
