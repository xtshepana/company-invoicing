"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { sendDraftInvoiceBatchAction } from "@/server/actions/invoice-actions";
import {
  BULK_SEND_BATCH_SIZE,
  chunk,
  splitSendable,
  summarizeBulkSend,
  type BulkSendResult,
  type DraftToSend,
} from "@/lib/bulk-send";
import { formatCurrency } from "@/lib/money";

type Phase = "confirm" | "sending" | "done";

const STATUS_LABELS: Record<BulkSendResult["status"], string> = {
  sent: "Sent",
  failed: "Not sent",
  skipped: "Skipped",
  no_email: "No email address",
};

/**
 * "Send drafts" on the invoices page: emails every draft invoice to its customer in small batches, with a progress bar
 * and a way to stop. Each invoice is marked Sent only once its email went out, and one that no longer is a draft is
 * skipped by the server, so a double click cannot email anyone twice.
 */
export function BulkSendDraftsDialog({ drafts, currency }: { drafts: DraftToSend[]; currency: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("confirm");
  const [handled, setHandled] = useState(0);
  // How many this run set out to send. The server refreshes the page as invoices go out, which shrinks `drafts` mid-run,
  // so progress is measured against this fixed number rather than the live list.
  const [planned, setPlanned] = useState(0);
  const [results, setResults] = useState<BulkSendResult[]>([]);
  const [stopped, setStopped] = useState(false);
  const stopRequested = useRef(false);

  // Only disappear when there is nothing to send and the window is not open - never out from under a running send.
  if (drafts.length === 0 && !open) return null;

  const { sendable, blocked } = splitSendable(drafts);
  const toSend = sendable.length;
  const sendableTotal = sendable.reduce((sum, draft) => sum + draft.total, 0);
  const summary = summarizeBulkSend(results);

  function openDialog() {
    setPhase("confirm");
    setResults([]);
    setHandled(0);
    setPlanned(0);
    setStopped(false);
    setOpen(true);
  }

  async function run() {
    stopRequested.current = false;
    setStopped(false);
    setResults([]);
    setHandled(0);
    setPlanned(sendable.length);
    setPhase("sending");

    const byId = new Map(drafts.map((draft) => [draft.id, draft]));
    const failure = (id: string, detail: string): BulkSendResult => ({
      invoiceId: id,
      invoiceNumber: byId.get(id)?.invoice_number ?? id,
      customerName: byId.get(id)?.customer_name ?? "",
      status: "failed",
      detail,
    });

    let done = 0;
    for (const ids of chunk(sendable.map((draft) => draft.id), BULK_SEND_BATCH_SIZE)) {
      if (stopRequested.current) {
        setStopped(true);
        break;
      }
      let batch: BulkSendResult[];
      try {
        const response = await sendDraftInvoiceBatchAction(ids);
        batch = response.error ? ids.map((id) => failure(id, response.error as string)) : response.results;
      } catch {
        batch = ids.map((id) => failure(id, "No reply from the server. Check this invoice's status before trying again."));
      }
      setResults((previous) => [...previous, ...batch]);
      done += ids.length;
      setHandled(done);
    }

    setPhase("done");
    router.refresh();
  }

  return (
    <>
      <Button variant="outline" onClick={openDialog}>
        <Send /> Send drafts ({drafts.length})
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (phase === "sending") return; // let a send finish (or be stopped) rather than closing the window on it
          setOpen(next);
        }}
      >
        <DialogContent className="sm:max-w-lg" showCloseButton={phase !== "sending"}>
          <DialogHeader>
            <DialogTitle>Send draft invoices</DialogTitle>
            <DialogDescription>
              {phase === "confirm"
                ? "Email your customers their draft invoices in one go."
                : phase === "sending"
                  ? "Please keep this window open until it finishes."
                  : "Finished."}
            </DialogDescription>
          </DialogHeader>

          {phase === "confirm" ? (
            <div className="space-y-3 text-sm">
              <p>
                <strong>{toSend}</strong> draft {toSend === 1 ? "invoice" : "invoices"} totalling{" "}
                <strong>{formatCurrency(sendableTotal, currency)}</strong> will be emailed to{" "}
                {toSend === 1 ? "its customer" : "their customers"} now, each with its PDF attached and a copy to your
                accounts mailbox. They are marked <strong>Sent</strong> as they go out.
              </p>
              {blocked.length > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
                  <p className="font-medium">
                    {blocked.length} can&apos;t be emailed (no single valid address) and will stay as drafts:
                  </p>
                  <p className="mt-1 text-xs">
                    {blocked.map((draft) => `${draft.invoice_number} ${draft.customer_name}`).join(" · ")}
                  </p>
                  <p className="mt-1 text-xs">Add their email address, or open the invoice and use Mark as Sent if you deliver it yourself.</p>
                </div>
              ) : null}
            </div>
          ) : null}

          {phase === "sending" ? (
            <div className="space-y-3 text-sm">
              <Progress value={planned === 0 ? 0 : Math.round((handled / planned) * 100)}>
                <span className="text-sm">
                  Sending… {handled} of {planned}
                </span>
              </Progress>
              <p className="text-xs text-muted-foreground">
                Sent so far: {summarizeBulkSend(results).sent}. Each invoice is sent a few seconds apart so the email service is not overloaded.
              </p>
            </div>
          ) : null}

          {phase === "done" ? (
            <div className="space-y-3 text-sm">
              <p>
                <strong>{summary.sent}</strong> {summary.sent === 1 ? "invoice" : "invoices"} sent.
                {stopped
                  ? ` You stopped it, so ${planned - handled} ${planned - handled === 1 ? "invoice was" : "invoices were"} not attempted and ${planned - handled === 1 ? "is" : "are"} still a draft.`
                  : ""}
              </p>
              {summary.problems.length > 0 ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-950">
                  <p className="font-medium">{summary.problems.length} need attention (still drafts):</p>
                  <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs">
                    {summary.problems.map((problem) => (
                      <li key={problem.invoiceId}>
                        <strong>
                          {problem.invoiceNumber} {problem.customerName}
                        </strong>{" "}
                        - {STATUS_LABELS[problem.status]}
                        {problem.detail ? `: ${problem.detail}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {blocked.length > 0 ? (
                <p className="text-xs text-muted-foreground">
                  {blocked.length} with no valid email address {blocked.length === 1 ? "was" : "were"} not attempted.
                </p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter>
            {phase === "confirm" ? (
              <>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={run} disabled={toSend === 0}>
                  <Send /> Send {toSend} {toSend === 1 ? "invoice" : "invoices"}
                </Button>
              </>
            ) : null}
            {phase === "sending" ? (
              <Button variant="outline" onClick={() => (stopRequested.current = true)}>
                Stop after this batch
              </Button>
            ) : null}
            {phase === "done" ? <Button onClick={() => setOpen(false)}>Close</Button> : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
