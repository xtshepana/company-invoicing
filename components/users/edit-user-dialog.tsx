"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModulePermissionCheckboxes } from "@/components/users/module-permission-checkboxes";
import { updateUserRoleAction } from "@/server/actions/user-management-actions";
import { ROLE_LABELS } from "@/lib/validations/users";
import type { Profile } from "@/server/services/auth";

export function EditUserDialog({ user, disabled }: { user: Profile; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [role, setRole] = useState(user.role);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await updateUserRoleAction({}, formData);
      if (result.success) {
        toast.success("User updated.");
        setOpen(false);
      } else if (result.error) {
        toast.error(result.error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            disabled={disabled}
            title={disabled ? "You cannot edit your own role" : "Edit role"}
          />
        }
      >
        <Pencil className="h-4 w-4" />
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {user.full_name || user.email}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" name="user_id" value={user.id} />
          <div className="space-y-2">
            <Label htmlFor={`role-${user.id}`}>Role</Label>
            <Select
              name="role"
              value={role}
              onValueChange={(value) => value && setRole(value as Profile["role"])}
              items={ROLE_LABELS}
            >
              <SelectTrigger id={`role-${user.id}`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner_admin">{ROLE_LABELS.owner_admin}</SelectItem>
                <SelectItem value="accountant">{ROLE_LABELS.accountant}</SelectItem>
                <SelectItem value="staff">{ROLE_LABELS.staff}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {role === "staff" ? (
            <ModulePermissionCheckboxes
              initialPermissions={(user.staff_module_permissions as Record<string, boolean>) ?? {}}
            />
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
