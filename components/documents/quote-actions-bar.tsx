"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Pencil, FileOutput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setQuoteStatusAction, convertQuoteToInvoiceAction } from "@/server/actions/quote-actions";
import type { Quote } from "@/server/services/quotes";

export function QuoteActionsBar({ quote }: { quote: Quote }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isConverted = Boolean(quote.converted_invoice_id);

  function setStatus(status: string) {
    const formData = new FormData();
    formData.set("id", quote.id);
    formData.set("status", status);
    startTransition(async () => {
      const result = await setQuoteStatusAction({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Quote updated.");
        router.refresh();
      }
    });
  }

  function convert() {
    const formData = new FormData();
    formData.set("id", quote.id);
    startTransition(async () => {
      const result = await convertQuoteToInvoiceAction({}, formData);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" render={<a href={`/api/pdf/quotes/${quote.id}`} target="_blank" rel="noreferrer" />} nativeButton={false}>
        <Download /> PDF
      </Button>
      {!isConverted ? (
        <Button variant="outline" render={<Link href={`/quotes/${quote.id}/edit`} />} nativeButton={false}>
          <Pencil /> Edit
        </Button>
      ) : null}
      {!isConverted && quote.status === "draft" ? (
        <Button variant="outline" disabled={pending} onClick={() => setStatus("sent")}>
          Mark as Sent
        </Button>
      ) : null}
      {!isConverted && (quote.status === "draft" || quote.status === "sent") ? (
        <>
          <Button variant="outline" disabled={pending} onClick={() => setStatus("accepted")}>
            Accept
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setStatus("rejected")}>
            Reject
          </Button>
        </>
      ) : null}
      {!isConverted && quote.status !== "cancelled" ? (
        <Button variant="outline" disabled={pending} onClick={() => setStatus("cancelled")}>
          Cancel
        </Button>
      ) : null}
      {!isConverted ? (
        <Button disabled={pending} onClick={convert}>
          <FileOutput /> Convert to Invoice
        </Button>
      ) : (
        <Button render={<Link href={`/invoices/${quote.converted_invoice_id}`} />} nativeButton={false}>
          View Invoice
        </Button>
      )}
    </div>
  );
}
