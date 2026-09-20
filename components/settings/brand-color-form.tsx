"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { updateAppearanceAction } from "@/server/actions/company-settings-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import { BRAND_COLOR_PRESETS, HEX_COLOR_PATTERN } from "@/lib/color-utils";
import { cn } from "@/lib/utils";

const initialState: ActionResult = {};

export function BrandColorForm({ brandColor }: { brandColor: string | null }) {
  const [state, formAction, pending] = useActionState(updateAppearanceAction, initialState);
  const lastState = useRef(state);
  const [selected, setSelected] = useState<string | null>(brandColor);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.success) toast.success("Brand color saved. Refresh to see it applied everywhere.");
    if (state.error) toast.error(state.error);
  }, [state]);

  const isValidCustom = selected !== null && HEX_COLOR_PATTERN.test(selected);

  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-2">
        <Label>Brand color</Label>
        <p className="text-sm text-muted-foreground">
          Used for buttons and highlights in the app, and as an accent on invoices, quotes, credit notes,
          and statements.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSelected(null)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-2 bg-background text-[10px] text-muted-foreground",
              selected === null ? "border-foreground" : "border-transparent"
            )}
            aria-label="Default (no brand color)"
            title="Default"
          >
            None
          </button>
          {BRAND_COLOR_PRESETS.map((preset) => (
            <button
              key={preset.hex}
              type="button"
              onClick={() => setSelected(preset.hex)}
              className={cn(
                "h-9 w-9 rounded-full border-2",
                selected?.toLowerCase() === preset.hex ? "border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: preset.hex }}
              aria-label={preset.name}
              title={preset.name}
            />
          ))}
        </div>
        <div className="flex items-center gap-2 pt-2">
          <Label htmlFor="brand_color_custom" className="text-xs text-muted-foreground">
            Custom hex
          </Label>
          <Input
            id="brand_color_custom"
            value={selected ?? ""}
            onChange={(event) => setSelected(event.target.value || null)}
            placeholder="#2563eb"
            className="w-32 font-mono"
          />
          {selected ? (
            <span
              className="h-6 w-6 shrink-0 rounded border"
              style={{ backgroundColor: isValidCustom ? selected : "transparent" }}
            />
          ) : null}
        </div>
        <input type="hidden" name="brand_color" value={selected ?? ""} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save brand color"}
      </Button>
    </form>
  );
}
