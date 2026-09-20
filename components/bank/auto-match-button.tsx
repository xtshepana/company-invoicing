"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { autoMatchBankTransactionsAction } from "@/server/actions/bank-transaction-actions";

export function AutoMatchButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    startTransition(async () => {
      const result = await autoMatchBankTransactionsAction();
      if (result.error) {
        toast.error(result.error);
        return;
      }
      const count = result.matchedCount ?? 0;
      toast.success(count === 0 ? "No new matches found." : `Matched ${count} transaction${count === 1 ? "" : "s"}.`);
      router.refresh();
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      <Wand2 /> {pending ? "Matching…" : "Auto-Match"}
    </Button>
  );
}
