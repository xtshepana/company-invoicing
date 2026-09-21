import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Contact } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ListFilters } from "@/components/shared/list-filters";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCurrentProfile, hasModuleAccess } from "@/server/services/auth";
import { listCustomers } from "@/server/services/customers";
import { customerSearchSchema } from "@/lib/validations/customers";

export const metadata: Metadata = { title: "Customers" };

interface CustomersPageProps {
  searchParams: Promise<Record<string, string | undefined>>;
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!hasModuleAccess(profile, "customers")) redirect("/dashboard");

  const params = customerSearchSchema.parse(await searchParams);
  const result = await listCustomers(params);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  function buildHref(page: number) {
    const sp = new URLSearchParams();
    if (params.q) sp.set("q", params.q);
    if (params.status !== "active") sp.set("status", params.status);
    if (params.sort !== "name_asc") sp.set("sort", params.sort);
    sp.set("page", String(page));
    return `/customers?${sp.toString()}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground">Manage the businesses and people you invoice.</p>
        </div>
        <Button render={<Link href="/customers/new" />} nativeButton={false}>
          <Plus /> Add Customer
        </Button>
      </div>

      <ListFilters
        searchValue={params.q}
        searchPlaceholder="Search by name, email, phone, account number…"
        selects={[
          {
            param: "status",
            value: params.status,
            options: [
              { value: "active", label: "Active" },
              { value: "archived", label: "Archived" },
              { value: "all", label: "All" },
            ],
          },
          {
            param: "sort",
            value: params.sort,
            options: [
              { value: "name_asc", label: "Name (A–Z)" },
              { value: "name_desc", label: "Name (Z–A)" },
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
            ],
          },
        ]}
      />

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 p-12 text-center">
              <Contact className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                {params.q || params.status !== "active"
                  ? "No customers match your filters."
                  : "No customers have been added yet."}
              </p>
              {!params.q && params.status === "active" ? (
                <Button size="sm" render={<Link href="/customers/new" />} nativeButton={false}>
                  <Plus /> Add Customer
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableCaption className="sr-only">Customers</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((customer) => (
                  <TableRow key={customer.id}>
                    <TableCell className="font-medium">
                      <Link href={`/customers/${customer.id}`} className="hover:underline">
                        {customer.company_name}
                      </Link>
                    </TableCell>
                    <TableCell>{customer.contact_person || "—"}</TableCell>
                    <TableCell>{customer.email || "—"}</TableCell>
                    <TableCell>{customer.phone || customer.mobile || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={customer.is_active ? "default" : "secondary"}>
                        {customer.is_active ? "Active" : "Archived"}
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
