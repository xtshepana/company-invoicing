"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setProductActiveAction } from "@/server/actions/product-actions";

export function ArchiveProductButton({ productId, isActive }: { productId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const formData = new FormData();
    formData.set("id", productId);
    formData.set("is_active", (!isActive).toString());
    startTransition(async () => {
      const result = await setProductActiveAction({}, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isActive ? "Item archived." : "Item reactivated.");
        router.refresh();
      }
    });
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={pending}>
      {pending ? "Saving…" : isActive ? "Archive" : "Reactivate"}
    </Button>
  );
}
