"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * router.back() when there's real in-app history to go back to; falls back
 * to a fixed parent route (e.g. the list page) when there isn't — a
 * bookmarked or freshly-opened URL has no useful browser history to return
 * to, so `back()` alone would be a dead end or leave the app entirely.
 */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 text-muted-foreground hover:text-foreground"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 2) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
    >
      <ArrowLeft className="h-4 w-4" />
      Back
    </Button>
  );
}
