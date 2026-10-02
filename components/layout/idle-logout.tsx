"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { idleLogoutAction } from "@/server/actions/auth-actions";
import { getIdleState } from "@/lib/idle";

const STORAGE_KEY = "idle-logout:last-activity";
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"] as const;

function readSharedActivity(): number {
  try {
    const parsed = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

function writeSharedActivity(timestamp: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(timestamp));
  } catch {
    // Storage blocked (private window etc.) - this tab's own timer still works, it just can't see other tabs.
  }
}

/**
 * Signs the user out after IDLE_TIMEOUT_MINUTES with no activity, warning
 * for the last IDLE_WARNING_SECONDS. Activity in any open tab counts (shared
 * through localStorage), and the check compares wall-clock time on every
 * tick, so a laptop waking from sleep past the limit signs out immediately
 * instead of waiting for a stale timer to fire.
 */
export function IdleLogout() {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivityRef = useRef(0);
  const signedOutRef = useRef(false);

  useEffect(() => {
    function recordActivity(force = false) {
      const now = Date.now();
      if (!force && now - lastActivityRef.current < 1000) return;
      lastActivityRef.current = now;
      writeSharedActivity(now);
    }

    recordActivity(true);
    const onActivity = () => recordActivity();
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true, capture: true });
    }

    const timer = window.setInterval(() => {
      lastActivityRef.current = Math.max(lastActivityRef.current, readSharedActivity());
      const state = getIdleState(Date.now(), lastActivityRef.current);

      if (state.status === "expired") {
        if (!signedOutRef.current) {
          signedOutRef.current = true;
          void idleLogoutAction();
        }
        return;
      }
      setSecondsLeft(state.status === "warning" ? state.secondsLeft : null);
    }, 1000);

    return () => {
      window.clearInterval(timer);
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity, { capture: true });
      }
    };
  }, []);

  if (secondsLeft === null) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed bottom-4 right-4 z-50 w-80 rounded-lg border bg-background p-4 shadow-lg"
    >
      <p className="font-medium">Still there?</p>
      <p className="mt-1 text-sm text-muted-foreground">
        You&apos;ll be signed out in {secondsLeft}s because of inactivity.
      </p>
      <Button
        className="mt-3 w-full"
        onClick={() => {
          const now = Date.now();
          lastActivityRef.current = now;
          writeSharedActivity(now);
          setSecondsLeft(null);
        }}
      >
        Stay signed in
      </Button>
    </div>
  );
}
