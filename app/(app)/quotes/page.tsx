import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listQuotes } from "@/server/services/quotes";
import { quoteSearchSchema, QUOTE_STATUS_LABELS, getQuoteDisplayStatus } from "@/lib/validations/quotes";
import { getCompanySettings } from "@/lib/config/system-settings";
import { formatCurrency } from "@/lib/money";

export const metadata: Metadata = { title: "Quotes" };

interface QuotesPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function QuotesPage({ searchParams }: QuotesPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "quotes")) redirect("/dashboard");

  const params = quoteSearchSchema.parse(await searchParams);
  const [result, settings] = await Promise.all([listQuotes(params), getCompanySettings()]);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status !== "all") sp.set("status", params.status);
    sp.set("page", String(page));
    return `/quotes?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground">Create and track quotations for customers.</p>
        </div>
        <Button render={<Link href="/quotes/new" />} nativeButton={false}>
          <Plus /> New Quote
        </Button>
      </div>

      <ListFilters
        searchValue={params.q}
        searchPlaceholder="Search by quote number or reference…"
        selects={[
          {
            param: "status",
            value: params.status,
            options: [{ value: "all", label: "All statuses" }, ...Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => ({ value, label }))],
          },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <FileText className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q || params.status !== "all" ? "No quotes match your filters." : "No quotes have been created yet."}
              </p>
              {!params.q && params.status === "all" ? (
                <Button size="sm" render={<Link href="/quotes/new" />} nativeButton={false}>
                  <Plus /> New Quote
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">Quotes</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Quote #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((quote) => (
                  <TableRow key={quote.id}>
                    <TableCell className="font-medium">
                      <Link href={`/quotes/${quote.id}`} className="hover:underline">
                        {quote.quote_number}
                      </Link>
                    </TableCell>
                    <TableCell>{quote.customers?.company_name ?? "—"}</TableCell>
                    <TableCell>{new Date(quote.quote_date).toLocaleDateString("en-ZA")}</TableCell>
                    <TableCell>{formatCurrency(quote.total, settings.default_currency)}</TableCell>
                    <TableCell>
                      <Badge variant={getQuoteDisplayStatus(quote).variant}>{getQuoteDisplayStatus(quote).label}</Badge>
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
