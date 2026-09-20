import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { getCurrentProfile } from "@/server/services/auth";
import { getAuditLogPage } from "@/server/services/audit-log-query";

export const metadata: Metadata = { title: "Audit Log" };

interface AuditLogPageProps {
  searchParams: Promise<{ page?: string }>;
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner_admin") redirect("/dashboard");

  const { page: pageParam } = await searchParams;
  const page = Number(pageParam ?? "1") || 1;
  const result = await getAuditLogPage(page);
  const totalPages = Math.max(1, Math.ceil(result.totalCount / result.pageSize));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          A permanent, admin-only record of actions taken in this application.
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {result.rows.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <Table>
              <TableCaption className="sr-only">Audit log entries</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString("en-ZA")}
                    </TableCell>
                    <TableCell>{row.actorName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.entity}
                      {row.entityId ? ` #${row.entityId.slice(0, 8)}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <PaginationBar page={page} totalPages={totalPages} buildHref={(p) => `/audit-log?page=${p}`} />
    </div>
  );
}
