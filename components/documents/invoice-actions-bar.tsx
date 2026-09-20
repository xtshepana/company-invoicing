"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { markInvoiceSentAction, voidInvoiceAction, cancelInvoiceAction } from "@/server/actions/invoice-actions";
import type { Invoice } from "@/server/services/invoices";

export function InvoiceActionsBar({ invoice }: { invoice: Invoice }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const canEdit = !["paid", "void", "cancelled"].includes(invoice.status) && invoice.amount_paid === 0;

  function markSent() {
    const formData = new FormData();
    formData.set("id", invoice.id);
    startTransition(async () => {
      const result = await markInvoiceSentAction({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Invoice marked as sent.");
        router.refresh();
      }
    });
  }

  function voidInvoice() {
    const formData = new FormData();
    formData.set("id", invoice.id);
    startTransition(async () => {
      const result = await voidInvoiceAction({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Invoice voided.");
        router.refresh();
      }
    });
  }

  function cancelInvoice() {
    const formData = new FormData();
    formData.set("id", invoice.id);
    startTransition(async () => {
      const result = await cancelInvoiceAction({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Invoice cancelled.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        render={<a href={`/api/pdf/invoices/${invoice.id}`} target="_blank" rel="noreferrer" />}
        nativeButton={false}
      >
        <Download /> PDF
      </Button>
      {canEdit ? (
        <Button variant="outline" render={<Link href={`/invoices/${invoice.id}/edit`} />} nativeButton={false}>
          <Pencil /> Edit
        </Button>
      ) : null}
      {invoice.status === "draft" ? (
        <Button variant="outline" disabled={pending} onClick={markSent}>
          Mark as Sent
        </Button>
      ) : null}
      {canEdit ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="outline" disabled={pending} />}>Cancel</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This marks {invoice.invoice_number} as cancelled. It stays on record but no longer counts as
                outstanding.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction onClick={cancelInvoice}>Cancel invoice</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {canEdit ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" disabled={pending} />}>Void</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Void this invoice?</AlertDialogTitle>
              <AlertDialogDescription>
                This permanently voids {invoice.invoice_number}. Voided invoices are never deleted — this keeps the
                audit trail intact.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction onClick={voidInvoice}>Void invoice</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
