"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  uploadCompanyLogoAction,
  removeCompanyLogoAction,
} from "@/server/actions/company-settings-actions";
import type { ActionResult } from "@/server/actions/auth-actions";

const initialState: ActionResult = {};

export function LogoUploadForm({ logoUrl }: { logoUrl: string | null }) {
  const [uploadState, uploadAction, uploadPending] = useActionState(uploadCompanyLogoAction, initialState);
  const [removeState, removeAction, removePending] = useActionState(removeCompanyLogoAction, initialState);
  const lastUploadState = useRef(uploadState);
  const lastRemoveState = useRef(removeState);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (uploadState === lastUploadState.current) return;
    lastUploadState.current = uploadState;
    if (uploadState.success) {
      toast.success("Logo updated.");
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

      <form ref={formRef} action={uploadAction} className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="logo">Upload new logo</Label>
          <input
            id="logo"
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            required
            className="block text-sm file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <p className="text-xs text-muted-foreground">PNG, JPEG, WEBP, or SVG. Max 2MB.</p>
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
