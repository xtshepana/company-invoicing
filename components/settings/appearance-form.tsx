"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { updateAppearanceAction } from "@/server/actions/company-settings-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import { BRAND_COLOR_PRESETS, HEX_COLOR_PATTERN } from "@/lib/color-utils";
import { PDF_TEMPLATES } from "@/lib/validations/company-settings";
import { PDF_TEMPLATE_LABELS } from "@/lib/pdf/templates";
import { cn } from "@/lib/utils";

const initialState: ActionResult = {};

const TEMPLATE_DESCRIPTIONS: Record<(typeof PDF_TEMPLATES)[number], string> = {
  classic: "Clean and businesslike - the original design.",
  modern: "A bold colored header band and tinted table.",
  minimal: "Airy and understated, with a single accent rule.",
  bold: "A full-height colored sidebar carries the branding.",
  elegant: "Serif type and a centered masthead - timeless and formal.",
};

export function AppearanceForm({
  brandColor,
  pdfTemplate,
}: {
  brandColor: string | null;
  pdfTemplate: string;
}) {
  const [state, formAction, pending] = useActionState(updateAppearanceAction, initialState);
  const lastState = useRef(state);
  const [selectedColor, setSelectedColor] = useState<string | null>(brandColor);
  const [selectedTemplate, setSelectedTemplate] = useState<string>(pdfTemplate);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.success) toast.success("Appearance saved. Refresh to see it applied everywhere.");
    if (state.error) toast.error(state.error);
  }, [state]);

  const isValidCustom = selectedColor !== null && HEX_COLOR_PATTERN.test(selectedColor);

  return (
    <form action={formAction} className="space-y-8">
      <div className="space-y-2">
        <Label>Brand color</Label>
        <p className="text-sm text-muted-foreground">
          Used for buttons and highlights in the app, and as an accent on invoices, quotes, credit notes, and
          statements.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            onClick={() => setSelectedColor(null)}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-2 bg-background text-[10px] text-muted-foreground",
              selectedColor === null ? "border-foreground" : "border-transparent"
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
              onClick={() => setSelectedColor(preset.hex)}
              className={cn(
                "h-9 w-9 rounded-full border-2",
                selectedColor?.toLowerCase() === preset.hex ? "border-foreground" : "border-transparent"
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
            value={selectedColor ?? ""}
            onChange={(event) => setSelectedColor(event.target.value || null)}
            placeholder="#2563eb"
            className="w-32 font-mono"
          />
          {selectedColor ? (
            <span
              className="h-6 w-6 shrink-0 rounded border"
              style={{ backgroundColor: isValidCustom ? selectedColor : "transparent" }}
            />
          ) : null}
        </div>
        <input type="hidden" name="brand_color" value={selectedColor ?? ""} />
      </div>

      <div className="space-y-2">
        <Label>Document template</Label>
        <p className="text-sm text-muted-foreground">
          The layout used for invoice, quote, and credit note PDFs. Open a preview to see each one rendered with
          your logo and brand color before picking.
        </p>
        <div className="grid gap-3 pt-1 sm:grid-cols-2">
          {PDF_TEMPLATES.map((template) => (
            <div
              key={template}
              className={cn(
                "flex items-start justify-between gap-3 rounded-md border p-3",
                selectedTemplate === template ? "border-foreground" : "border-border"
              )}
            >
              <label className="flex flex-1 cursor-pointer items-start gap-2">
                <input
                  type="radio"
                  name="pdf_template"
                  value={template}
                  checked={selectedTemplate === template}
                  onChange={() => setSelectedTemplate(template)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">{PDF_TEMPLATE_LABELS[template]}</span>
                  <span className="block text-xs text-muted-foreground">{TEMPLATE_DESCRIPTIONS[template]}</span>
                </span>
              </label>
              <a
                href={`/api/pdf/template-preview/${template}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                Preview <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save appearance"}
      </Button>
    </form>
  );
}
