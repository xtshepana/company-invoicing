"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModulePermissionCheckboxes } from "@/components/users/module-permission-checkboxes";
import { inviteUserAction } from "@/server/actions/user-management-actions";
import { ROLE_LABELS } from "@/lib/validations/users";

export function InviteUserDialog() {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState("staff");
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await inviteUserAction({}, formData);
      if (result.success) {
        toast.success("Invite sent.");
        formRef.current?.reset();
        setOpen(false);
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus /> Invite user
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite a user</DialogTitle>
          <DialogDescription>They&apos;ll receive an email with a link to set their password.</DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite_full_name">Full name</Label>
            <Input id="invite_full_name" name="full_name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite_email">Email</Label>
            <Input id="invite_email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite_role">Role</Label>
            <Select name="role" value={role} onValueChange={(value) => value && setRole(value)} items={ROLE_LABELS}>
              <SelectTrigger id="invite_role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner_admin">{ROLE_LABELS.owner_admin}</SelectItem>
                <SelectItem value="accountant">{ROLE_LABELS.accountant}</SelectItem>
                <SelectItem value="staff">{ROLE_LABELS.staff}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === "staff" ? <ModulePermissionCheckboxes /> : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Sending invite…" : "Send invite"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
