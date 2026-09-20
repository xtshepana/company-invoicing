"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Pencil, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  setRecurringInvoiceStatusAction,
  skipNextRecurringInvoiceAction,
} from "@/server/actions/recurring-invoice-actions";
import type { RecurringInvoice } from "@/server/services/recurring-invoices";

export function RecurringInvoiceActionsBar({ recurringInvoice }: { recurringInvoice: RecurringInvoice }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function setStatus(status: string) {
    const formData = new FormData();
    formData.set("id", recurringInvoice.id);
    formData.set("status", status);
    startTransition(async () => {
      const result = await setRecurringInvoiceStatusAction({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Updated.");
        router.refresh();
      }
    });
  }

  function skipNext() {
    const formData = new FormData();
    formData.set("id", recurringInvoice.id);
    startTransition(async () => {
      const result = await skipNextRecurringInvoiceAction({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Next invoice skipped.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {recurringInvoice.status !== "cancelled" ? (
        <Button variant="outline" render={<Link href={`/recurring-invoices/${recurringInvoice.id}/edit`} />} nativeButton={false}>
          <Pencil /> Edit
        </Button>
      ) : null}
      {recurringInvoice.status === "active" ? (
        <>
          <Button variant="outline" disabled={pending} onClick={skipNext}>
            <SkipForward /> Skip Next
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => setStatus("paused")}>
            Pause
          </Button>
        </>
      ) : null}
      {recurringInvoice.status === "paused" ? (
        <Button variant="outline" disabled={pending} onClick={() => setStatus("active")}>
          Resume
        </Button>
      ) : null}
      {recurringInvoice.status !== "cancelled" ? (
        <Button variant="destructive" disabled={pending} onClick={() => setStatus("cancelled")}>
          Cancel
        </Button>
      ) : null}
    </div>
  );
}
