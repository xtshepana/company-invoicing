"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setSupplierActiveAction } from "@/server/actions/supplier-actions";

export function ArchiveSupplierButton({ supplierId, isActive }: { supplierId: string; isActive: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleClick() {
    const formData = new FormData();
    formData.set("id", supplierId);
    formData.set("is_active", (!isActive).toString());
    startTransition(async () => {
      const result = await setSupplierActiveAction({}, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(isActive ? "Supplier archived." : "Supplier reactivated.");
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
