import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile } from "@/server/services/auth";
import { listNotices } from "@/server/services/notices";

export const metadata: Metadata = { title: "Notices" };

export default async function NoticesPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner_admin") redirect("/dashboard");

  const notices = await listNotices();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notices</h1>
          <p className="text-muted-foreground">
            Send an announcement to your customers - a name or banking details change, a price update, anything they
            need to know.
          </p>
        </div>
        <Button render={<Link href="/notices/new" />} nativeButton={false}>
          <Plus /> New notice
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {notices.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No notices sent yet.</p>
          ) : (
            <Table>
              <TableCaption className="sr-only">Notices sent to customers</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Sent</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Recipients</TableHead>
                  <TableHead className="text-right">Delivered</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {notices.map((notice) => (
                  <TableRow key={notice.id}>
                    <TableCell className="whitespace-nowrap">{new Date(notice.created_at).toLocaleString("en-ZA")}</TableCell>
                    <TableCell>
                      <Link href={`/notices/${notice.id}`} className="font-medium hover:underline">
                        {notice.subject}
                      </Link>
                      {notice.status === "sending" ? (
                        <Badge variant="outline" className="ml-2">
                          Sending
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right">{notice.recipient_count}</TableCell>
                    <TableCell className="text-right">{notice.sent_count}</TableCell>
                    <TableCell className="text-right">
                      {notice.failed_count > 0 ? (
                        <Badge variant="destructive">{notice.failed_count}</Badge>
                      ) : (
                        notice.failed_count
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
