import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PaginationBar({
  page,
  totalPages,
  buildHref,
}: {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        nativeButton={page <= 1}
        render={page > 1 ? <Link href={buildHref(page - 1)} /> : undefined}
      >
        Previous
      </Button>
      <span className="text-sm text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        disabled={page >= totalPages}
        nativeButton={page >= totalPages}
        render={page < totalPages ? <Link href={buildHref(page + 1)} /> : undefined}
      >
        Next
      </Button>
    </div>
  );
}
