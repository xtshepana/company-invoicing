"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  uploadCompanyLogoAction,
  removeCompanyLogoAction,
} from "@/server/actions/company-settings-actions";
import type { ActionResult } from "@/server/actions/auth-actions";
import { readLogoColors, type BrandColors } from "@/lib/branding/logo-colors";

const initialState: ActionResult = {};
const NO_COLORS: BrandColors = { primary: null, secondary: null };

export function LogoUploadForm({ logoUrl }: { logoUrl: string | null }) {
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadCompanyLogoAction, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeCompanyLogoAction, initialState);
  const lastUploadState = useRef(uploadState);
  const lastRemoveState = useRef(removeState);
  const formRef = useRef<HTMLFormElement>(null);
  // The two main colours found in the file the user has just picked; posted with it and saved as the brand colours.
  // They belong to the upload state they were picked under, so after an upload completes (a new state object)
  // they count as used and the form shows none - no reset needed.
  const [picked, setPicked] = useState<{ colors: BrandColors; forState: ActionResult }>({ colors: NO_COLORS, forState: uploadState });
  const colors = picked.forState === uploadState ? picked.colors : NO_COLORS;
  const postedColors = useRef(false);

  useEffect(() => {
    if (uploadState === lastUploadState.current) return;
    lastUploadState.current = uploadState;
    if (uploadState.success) {
      toast.success(postedColors.current ? "Logo updated. Brand colours set from your logo." : "Logo updated.");
      formRef.current?.reset();
    }
    if (uploadState.error) toast.error(uploadState.error);
  }, [uploadState]);

  useEffect(() => {
    if (removeState === lastRemoveState.current) return;
    lastRemoveState.current = removeState;
    if (removeState.success) toast.success("Logo removed.");
    if (removeState.error) toast.error(removeState.error);
  }, [removeState]);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Current logo</Label>
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external Supabase Storage URL, not a static asset Next can optimize
          <img src={logoUrl} alt="Company logo" className="h-16 w-auto rounded border bg-white p-2" />
        ) : (
          <p className="text-sm text-muted-foreground">No logo uploaded yet.</p>
        )}
      </div>

      <form
        ref={formRef}
        action={(formData) => {
          postedColors.current = Boolean(formData.get("brand_color"));
          uploadAction(formData);
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <input type="hidden" name="brand_color" value={colors.primary ?? ""} />
        <input type="hidden" name="brand_color_secondary" value={colors.secondary ?? ""} />
        <div className="space-y-2">
          <Label htmlFor="logo">Upload new logo</Label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            required
            onChange={async (event) => {
              const file = event.target.files?.[0];
              const found = file ? await readLogoColors(file) : NO_COLORS;
              setPicked({ colors: found, forState: uploadState });
            }}
            className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="text-xs text-muted-foreground">PNG, JPEG, WEBP, or SVG. Max 2MB.</p>
          {colors.primary ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              Brand colours found in this logo:
              {[colors.primary, colors.secondary].map((color) =>
                color ? (
                  <span key={color} className="inline-flex items-center gap-1 font-mono">
                    <span className="h-4 w-4 rounded border" style={{ backgroundColor: color }} />
                    {color}
                  </span>
                ) : null
              )}
              <span>- saved when you upload.</span>
            </p>
          ) : null}
        </div>
        <Button type="submit" disabled={uploadPending}>
          {uploadPending ? "Uploading…" : "Upload logo"}
        </Button>
        {logoUrl ? (
          <Button
            type="button"
            variant="outline"
            disabled={removePending}
            onClick={() => removeAction()}
          >
            {removePending ? "Removing…" : "Remove logo"}
          </Button>
        ) : null}
      </form>
    </div>
  );
}
