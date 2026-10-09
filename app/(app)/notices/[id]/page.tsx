import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getCurrentProfile } from "@/server/services/auth";
import { getNotice, getNoticeDeliveries } from "@/server/services/notices";
import { BackButton } from "@/components/shared/back-button";

export const metadata: Metadata = { title: "Notice" };

interface NoticeDetailPageProps {
  params: Promise<{ id: string }>;
}

const RESULT_LABELS = { sent: "Delivered", failed: "Failed", skipped: "Not sent" } as const;
const RESULT_VARIANTS = { sent: "default", failed: "destructive", skipped: "secondary" } as const;

export default async function NoticeDetailPage({ params }: NoticeDetailPageProps) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "owner_admin") redirect("/dashboard");

  const { id } = await params;
  const notice = await getNotice(id);
  if (!notice) notFound();
  const deliveries = await getNoticeDeliveries(id);

  return (
    <div className="space-y-6">
      <BackButton fallbackHref="/notices" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{notice.subject}</h1>
        <p className="text-muted-foreground">
          Sent {new Date(notice.created_at).toLocaleString("en-ZA")} to {notice.recipient_count} customer
          {notice.recipient_count === 1 ? "" : "s"} - {notice.sent_count} delivered
          {notice.failed_count > 0 ? `, ${notice.failed_count} failed` : ""}.
        </p>
        {notice.status === "sending" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Still sending, or it was interrupted. Refresh in a minute. If it stays like this, check the list
            below to see who received it before sending again.
          </p>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Message</CardTitle>
        </CardHeader>
        <CardContent className="whitespace-pre-line text-sm">{notice.body}</CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Delivery</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {deliveries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No delivery records yet.</p>
          ) : (
            <Table>
              <TableCaption className="sr-only">Delivery results for this notice</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Result</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deliveries.map((delivery) => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-medium">{delivery.customerName ?? "-"}</TableCell>
                    <TableCell>{delivery.recipient}</TableCell>
                    <TableCell>
                      <Badge variant={RESULT_VARIANTS[delivery.status]}>{RESULT_LABELS[delivery.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{delivery.error ?? ""}</TableCell>
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
