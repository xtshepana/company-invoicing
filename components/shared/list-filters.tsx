"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useRef } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export interface FilterSelectConfig {
  param: string;
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}

/**
 * Generic server-side search/filter bar: pushes query params and lets the
 * server component re-fetch, rather than filtering client-side — never
 * loads a whole table into the browser to filter it locally.
 */
export function ListFilters({
  searchParam = "q",
  searchValue,
  searchPlaceholder = "Search…",
  selects,
}: {
  searchParam?: string;
  searchValue?: string;
  searchPlaceholder?: string;
  selects: FilterSelectConfig[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function updateParam(param: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(param, value);
    else params.delete(param);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => updateParam(searchParam, value), 350);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={searchPlaceholder}
          defaultValue={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
      </div>
      {selects.map((select) => (
        <Select
          key={select.param}
          value={select.value}
          onValueChange={(v) => v && updateParam(select.param, v)}
          // Lets <SelectValue> show the label immediately, without first
          // requiring the popup to have mounted once (see select.tsx).
          items={Object.fromEntries(select.options.map((opt) => [opt.value, opt.label]))}
        >
          <SelectTrigger className={select.className ?? "w-full sm:w-40"}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {select.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ))}
    </div>
  );
}
