import { describe, it, expect } from "vitest";
import { getIdleState, IDLE_TIMEOUT_MS, IDLE_WARNING_MS } from "@/lib/idle";

const T0 = 1_700_000_000_000;

describe("getIdleState", () => {
  it("is active right after activity", () => {
    expect(getIdleState(T0, T0)).toEqual({ status: "active" });
  });

  it("stays active until the warning window opens", () => {
    expect(getIdleState(T0 + IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1, T0)).toEqual({ status: "active" });
  });

  it("starts warning with the full warning length left", () => {
    expect(getIdleState(T0 + IDLE_TIMEOUT_MS - IDLE_WARNING_MS, T0)).toEqual({
      status: "warning",
      secondsLeft: IDLE_WARNING_MS / 1000,
    });
  });

  it("rounds a partial second up so the countdown never shows 0 while still signed in", () => {
    expect(getIdleState(T0 + IDLE_TIMEOUT_MS - 400, T0)).toEqual({ status: "warning", secondsLeft: 1 });
  });

  it("expires exactly at the timeout", () => {
    expect(getIdleState(T0 + IDLE_TIMEOUT_MS, T0)).toEqual({ status: "expired" });
  });

  it("reads as expired straight away after waking from a long sleep", () => {
    expect(getIdleState(T0 + IDLE_TIMEOUT_MS * 20, T0)).toEqual({ status: "expired" });
  });

  it("treats activity timestamped in the future (clock adjustment) as active", () => {
    expect(getIdleState(T0, T0 + 60_000)).toEqual({ status: "active" });
  });
});
