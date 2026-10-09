"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Send, FlaskConical, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { sendNoticeAction, sendNoticeTestAction } from "@/server/actions/notice-actions";
import { customerNoticeEmail } from "@/lib/email/templates";
import {
  BANKING_CHANGE_TEMPLATE,
  NOTICE_PLACEHOLDERS,
  renderNoticeBodyHtml,
  renderNoticeSubject,
  validateNoticeContent,
  type NoticeCompany,
} from "@/lib/notices";
import type { NoticeRecipient } from "@/server/services/notices";

interface NoticeComposerProps {
  recipients: NoticeRecipient[];
  unreachable: { id: string; companyName: string; reason: string }[];
  company: NoticeCompany;
  adminEmail: string;
  sendToken: string;
}

const PLACEHOLDER_HINTS: Record<(typeof NOTICE_PLACEHOLDERS)[number], string> = {
  customer_name: "The customer's company name",
  account_number: "The customer's account number",
  company_name: "Your company name",
  company_email: "Your company email",
  company_phone: "Your company phone number",
  bank_details: "Your bank details from Settings",
};

export function NoticeComposer({ recipients, unreachable, company, adminEmail, sendToken }: NoticeComposerProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selected, setSelected] = useState<Set<string>>(() => new Set(recipients.map((recipient) => recipient.id)));
  const [search, setSearch] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const problem = subject.trim() || body.trim() ? validateNoticeContent(subject, body, company) : null;
  const canSend = subject.trim() !== "" && body.trim() !== "" && problem === null && selected.size > 0 && !pending;

  const visibleRecipients = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return recipients;
    return recipients.filter(
      (recipient) => recipient.companyName.toLowerCase().includes(term) || recipient.email.toLowerCase().includes(term)
    );
  }, [recipients, search]);

  const preview = useMemo(() => {
    const first = recipients.find((recipient) => selected.has(recipient.id));
    const vars = {
      customerName: first?.companyName ?? "Sample Customer",
      accountNumber: first?.accountNumber ?? "ABC001",
      company,
    };
    const content = customerNoticeEmail({
      companyName: company.name,
      subject: renderNoticeSubject(subject || "(no subject yet)", vars),
      bodyHtml: renderNoticeBodyHtml(body || "(Your message will appear here.)", vars),
    });
    return { ...content, customerName: vars.customerName };
  }, [recipients, selected, company, subject, body]);

  function toggle(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function insertPlaceholder(name: string) {
    const token = `{${name}}`;
    const element = bodyRef.current;
    if (!element) {
      setBody((current) => current + token);
      return;
    }
    const start = element.selectionStart ?? body.length;
    const end = element.selectionEnd ?? start;
    setBody(body.slice(0, start) + token + body.slice(end));
    requestAnimationFrame(() => {
      element.focus();
      element.setSelectionRange(start + token.length, start + token.length);
    });
  }

  function applyTemplate() {
    if (body.trim() && !window.confirm("Replace what you've written with the banking details template?")) return;
    setSubject(BANKING_CHANGE_TEMPLATE.subject);
    setBody(BANKING_CHANGE_TEMPLATE.body);
  }

  function buildFormData(withRecipients: boolean) {
    const formData = new FormData();
    formData.set("subject", subject);
    formData.set("body", body);
    if (withRecipients) {
      formData.set("customer_ids", JSON.stringify([...selected]));
      formData.set("send_token", sendToken);
    }
    return formData;
  }

  function sendTest() {
    startTransition(async () => {
      try {
        const result = await sendNoticeTestAction({}, buildFormData(false));
        if (result.error) toast.error(result.error);
        else toast.success(`Test sent to ${adminEmail}. Check your inbox.`);
      } catch {
        toast.error("Couldn't send the test - you may have been signed out. Refresh the page and try again.");
      }
    });
  }

  function sendNow() {
    startTransition(async () => {
      try {
        const result = await sendNoticeAction({}, buildFormData(true));
        if (result.error || !result.id) {
          toast.error(result.error ?? "Something went wrong. Please try again.");
          return;
        }
        toast.success("Notice sent.");
        router.push(`/notices/${result.id}`);
      } catch {
        // Could be a signed-out session (nothing sent) or a dropped connection after sending began - don't guess.
        toast.error("Couldn't confirm the result. Open Notices to see whether it went out before trying again.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Message</CardTitle>
            <CardDescription>
              Each customer gets their own email, signed from {company.name}. Start with your own greeting - for
              example &quot;Dear {"{customer_name}"},&quot; or &quot;Dear Kati Technologies customers,&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button type="button" variant="outline" size="sm" onClick={applyTemplate} disabled={pending}>
              <FileText /> Use the name &amp; banking details template
            </Button>

            <div className="space-y-2">
              <Label htmlFor="notice-subject">Subject</Label>
              <Input
                id="notice-subject"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                maxLength={150}
                disabled={pending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notice-body">Message</Label>
              <Textarea
                id="notice-body"
                ref={bodyRef}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={12}
                disabled={pending}
              />
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>Insert:</span>
                {NOTICE_PLACEHOLDERS.map((name) => (
                  <Button
                    key={name}
                    type="button"
                    variant="outline"
                    size="xs"
                    title={PLACEHOLDER_HINTS[name]}
                    onClick={() => insertPlaceholder(name)}
                    disabled={pending}
                  >
                    {`{${name}}`}
                  </Button>
                ))}
              </div>
              {!company.bank ? (
                <p className="text-xs text-muted-foreground">
                  Your bank details aren&apos;t complete yet, so {"{bank_details}"} can&apos;t be used.{" "}
                  <Link href="/settings" className="text-primary hover:underline">
                    Add them in Settings
                  </Link>
                  .
                </p>
              ) : null}
              {problem ? <p className="text-sm text-destructive">{problem}</p> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Recipients ({selected.size} of {recipients.length} selected)
            </CardTitle>
            <CardDescription>Active customers with a valid email address.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder="Search customers"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="max-w-56"
                disabled={pending}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setSelected(new Set(recipients.map((recipient) => recipient.id)))}
                disabled={pending}
              >
                Select all
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setSelected(new Set())} disabled={pending}>
                Clear
              </Button>
            </div>
            <div className="max-h-72 divide-y overflow-y-auto rounded-md border">
              {visibleRecipients.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground">No customers match.</p>
              ) : (
                visibleRecipients.map((recipient) => (
                  <label
                    key={recipient.id}
                    htmlFor={`recipient-${recipient.id}`}
                    className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-muted/50"
                  >
                    <Checkbox
                      id={`recipient-${recipient.id}`}
                      checked={selected.has(recipient.id)}
                      onCheckedChange={(checked) => toggle(recipient.id, Boolean(checked))}
                      disabled={pending}
                    />
                    <span className="font-medium">{recipient.companyName}</span>
                    <span className="truncate text-muted-foreground">{recipient.email}</span>
                  </label>
                ))
              )}
            </div>
            {unreachable.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                Won&apos;t receive it ({unreachable.length}):{" "}
                {unreachable.map((customer) => `${customer.companyName} (${customer.reason.toLowerCase()})`).join(", ")}.
                Add an email on their customer page to include them.
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              As {preview.customerName} would see it. Subject: <strong>{preview.subject}</strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <iframe
              title="Email preview"
              sandbox=""
              srcDoc={`<!doctype html><body style="margin:16px;background:#fff">${preview.html}</body>`}
              className="h-[30rem] w-full rounded-md border bg-white"
            />
          </CardContent>
        </Card>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" onClick={sendTest} disabled={!(subject.trim() && body.trim()) || problem !== null || pending}>
            <FlaskConical /> Send me a test
          </Button>
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogTrigger render={<Button type="button" disabled={!canSend} />}>
              <Send /> {pending ? "Sending…" : `Send to ${selected.size} customer${selected.size === 1 ? "" : "s"}`}
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Send this notice to {selected.size} customer{selected.size === 1 ? "" : "s"}?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Each customer gets their own email from {company.name}. This can&apos;t be undone, so make sure
                  you&apos;ve sent yourself a test first.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Back</AlertDialogCancel>
                <AlertDialogAction onClick={sendNow}>Send notice</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
        {pending ? <p className="text-sm text-muted-foreground">Sending - this can take up to a minute. Please keep this page open.</p> : null}
      </div>
    </div>
  );
}
