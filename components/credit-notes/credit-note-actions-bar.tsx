"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Download, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { issueCreditNoteAction, voidCreditNoteAction } from "@/server/actions/credit-note-actions";
import type { CreditNote } from "@/server/services/credit-notes";

export function CreditNoteActionsBar({ creditNote }: { creditNote: CreditNote }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function issue() {
    const formData = new FormData();
    formData.set("id", creditNote.id);
    startTransition(async () => {
      const result = await issueCreditNoteAction({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Credit note issued — the customer's credit balance has been updated.");
        router.refresh();
      }
    });
  }

  function voidNote() {
    const formData = new FormData();
    formData.set("id", creditNote.id);
    startTransition(async () => {
      const result = await voidCreditNoteAction({}, formData);
      if (result.error) toast.error(result.error);
      else {
        toast.success("Credit note cancelled.");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="outline"
        render={<a href={`/api/pdf/credit-notes/${creditNote.id}`} target="_blank" rel="noreferrer" />}
        nativeButton={false}
      >
        <Download /> PDF
      </Button>
      {creditNote.status === "draft" ? (
        <Button variant="outline" render={<Link href={`/credit-notes/${creditNote.id}/edit`} />} nativeButton={false}>
          <Pencil /> Edit
        </Button>
      ) : null}
      {creditNote.status === "draft" ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button disabled={pending} />}>Issue</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Issue this credit note?</AlertDialogTitle>
              <AlertDialogDescription>
                This adds {creditNote.credit_note_number}&apos;s total to the customer&apos;s available credit and
                can no longer be edited afterward. The customer will be emailed a copy if they have an email on
                file.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction onClick={issue}>Issue credit note</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
      {creditNote.status !== "cancelled" ? (
        <AlertDialog>
          <AlertDialogTrigger render={<Button variant="destructive" disabled={pending} />}>Cancel</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this credit note?</AlertDialogTitle>
              <AlertDialogDescription>
                {creditNote.status === "issued"
                  ? "This reverses the credit this note added to the customer's balance (only possible if it hasn't been used yet) and marks it cancelled. It stays on record."
                  : "This marks the credit note as cancelled. It stays on record but can no longer be issued."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Back</AlertDialogCancel>
              <AlertDialogAction onClick={voidNote}>Cancel credit note</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </div>
  );
}
