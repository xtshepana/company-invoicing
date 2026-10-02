import { IDLE_TIMEOUT_MINUTES, IDLE_WARNING_SECONDS } from "@/lib/config/defaults";

export const IDLE_TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60_000;
export const IDLE_WARNING_MS = IDLE_WARNING_SECONDS * 1000;

export type IdleState =
  | { status: "active" }
  | { status: "warning"; secondsLeft: number }
  | { status: "expired" };

/**
 * Wall-clock comparison rather than a countdown, so a machine waking from
 * sleep past the limit reads as "expired" immediately. A lastActivity in
 * the future (clock adjustment) just counts as active.
 */
export function getIdleState(now: number, lastActivity: number): IdleState {
  const remaining = IDLE_TIMEOUT_MS - (now - lastActivity);
  if (remaining <= 0) return { status: "expired" };
  if (remaining <= IDLE_WARNING_MS) return { status: "warning", secondsLeft: Math.ceil(remaining / 1000) };
  return { status: "active" };
}
