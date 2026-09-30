"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { respondToQuoteAction } from "@/server/actions/client-portal-actions";

export function QuoteResponseForm({ quoteId }: { quoteId: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function respond(decision: "accepted" | "rejected") {
    const formData = new FormData();
    formData.set("quote_id", quoteId);
    formData.set("decision", decision);
    startTransition(async () => {
      const result = await respondToQuoteAction({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success(decision === "accepted" ? "Quote accepted." : "Quote declined.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => respond("accepted")}>
        Accept quote
      </Button>
      <Button variant="outline" disabled={pending} onClick={() => respond("rejected")}>
        Decline quote
      </Button>
    </div>
  );
}
