"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setCustomerActiveAction } from "@/server/actions/customer-actions";

export function ArchiveCustomerButton({ customerId, isActive }: { customerId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const formData = new FormData();
    formData.set("id", customerId);
    formData.set("is_active", (!isActive).toString());
    startTransition(async () => {
      const result = await setCustomerActiveAction({}, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isActive ? "Customer archived." : "Customer reactivated.");
        router.refresh();
      }
    });
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={pending}>
      {pending ? "Saving…" : isActive ? "Archive" : "Reactivate"}
    </Button>
  );
}
