"use client";

import { useActionState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setUserActiveAction } from "@/server/actions/user-management-actions";
import type { ActionResult } from "@/server/actions/auth-actions";

const initialState: ActionResult = {};

export function UserStatusToggle({
  userId,
  isActive,
  disabled,
}: {
  userId: string;
  isActive: boolean;
  disabled?: boolean;
}) {
  const [state, formAction, pending] = useActionState(setUserActiveAction, initialState);
  const lastState = useRef(state);

  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (state.error) toast.error(state.error);
  }, [state]);

  return (
    <form action={formAction}>
      <input type="hidden" name="user_id" value={userId} />
      <input type="hidden" name="is_active" value={(!isActive).toString()} />
      <Button
        type="submit"
        variant={isActive ? "outline" : "secondary"}
        size="sm"
        disabled={disabled || pending}
        title={disabled ? "You cannot deactivate your own account" : undefined}
      >
        {pending ? "Saving…" : isActive ? "Deactivate" : "Activate"}
      </Button>
    </form>
  );
}
