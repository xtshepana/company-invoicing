import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FileMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listCreditNotes } from "@/server/services/credit-notes";
import { creditNoteSearchSchema, CREDIT_NOTE_STATUS_LABELS } from "@/lib/validations/credit-notes";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";

export const metadata: Metadata = { title: "Credit Notes" };

interface CreditNotesPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  issued: "default",
  cancelled: "destructive",
};

export default async function CreditNotesPage({ searchParams }: CreditNotesPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "invoices")) redirect("/dashboard");

  const params = creditNoteSearchSchema.parse(await searchParams);
  const [result, settings] = await Promise.all([listCreditNotes(params), getCompanySettings()]);
  const currency = settings.default_currency;
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status !== "all") sp.set("status", params.status);
    sp.set("page", String(page));
    return `/credit-notes?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Credit Notes</h1>
          <p className="text-muted-foreground">Credits issued to customers, and where they came from.</p>
        </div>
        <Button render={<Link href="/credit-notes/new" />} nativeButton={false}>
          <Plus /> New Credit Note
        </Button>
      </div>

      <ListFilters
        searchValue={params.q}
        searchPlaceholder="Search by number or reason…"
        selects={[
          {
            param: "status",
            value: params.status,
            options: [
              { value: "all", label: "All" },
              { value: "draft", label: "Draft" },
              { value: "issued", label: "Issued" },
              { value: "cancelled", label: "Cancelled" },
            ],
          },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FileMinus className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q ? "No credit notes match your search." : "No credit notes have been created yet."}
              </p>
              {!params.q ? (
                <Button size="sm" render={<Link href="/credit-notes/new" />} nativeButton={false}>
                  <Plus /> New Credit Note
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">Credit notes</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Invoice</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((creditNote) => (
                  <TableRow key={creditNote.id}>
                    <TableCell className="font-medium">
                      <Link href={`/credit-notes/${creditNote.id}`} className="hover:underline">
                        {creditNote.credit_note_number}
                      </Link>
                    </TableCell>
                    <TableCell>{new Date(creditNote.credit_note_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>{creditNote.customers?.company_name ?? "—"}</TableCell>
                    <TableCell>{creditNote.invoices?.invoice_number ?? "—"}</TableCell>
                    <TableCell className="text-right">{formatCurrency(creditNote.total, currency)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANTS[creditNote.status]}>
                        {CREDIT_NOTE_STATUS_LABELS[creditNote.status]}
                      </Badge>
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
