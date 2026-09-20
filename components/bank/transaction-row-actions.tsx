"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MatchTransactionDialog } from "@/components/bank/match-transaction-dialog";
import {
  ignoreBankTransactionAction,
  restoreBankTransactionAction,
  unmatchBankTransactionAction,
} from "@/server/actions/bank-transaction-actions";
import type { Database } from "@/types/database";

interface TransactionRowActionsProps {
  id: string;
  status: Database["public"]["Enums"]["bank_transaction_status"];
  amount: number;
  transactionDate: string;
  description: string;
  reference: string | null;
  currency: string;
}

export function TransactionRowActions({
  id,
  status,
  amount,
  transactionDate,
  description,
  reference,
  currency,
}: TransactionRowActionsProps) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function runAction(
    action: (prev: Record<string, never>, formData: FormData) => Promise<{ success?: boolean; error?: string }>,
    successMessage: string
  ) {
    const formData = new FormData();
    formData.set("transaction_id", id);
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success(successMessage);
        router.refresh();
      }
    });
  }

  if (status === "unmatched") {
    return (
      <div className="flex items-center gap-2">
        <MatchTransactionDialog
          transaction={{ id, amount, transaction_date: transactionDate, description, reference }}
          currency={currency}
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => runAction(ignoreBankTransactionAction, "Transaction ignored.")}
        >
          Ignore
        </Button>
      </div>
    );
  }

  if (status === "matched") {
    return (
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => runAction(unmatchBankTransactionAction, "Transaction unmatched.")}
      >
        Unmatch
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() => runAction(restoreBankTransactionAction, "Transaction restored.")}
    >
      Restore
    </Button>
  );
}
