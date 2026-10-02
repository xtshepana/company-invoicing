// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act, cleanup } from "@testing-library/react";

const idleLogoutAction = vi.fn(async () => {});
vi.mock("@/server/actions/auth-actions", () => ({
  idleLogoutAction: () => idleLogoutAction(),
}));

import { IdleLogout } from "@/components/layout/idle-logout";
import { IDLE_TIMEOUT_MINUTES, IDLE_WARNING_SECONDS } from "@/lib/config/defaults";

const TIMEOUT_MS = IDLE_TIMEOUT_MINUTES * 60_000;
const WARNING_MS = IDLE_WARNING_SECONDS * 1000;

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("IdleLogout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.localStorage.clear();
    idleLogoutAction.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("stays quiet while the user is active", () => {
    render(<IdleLogout />);
    advance(TIMEOUT_MS - WARNING_MS - 5000);
    expect(screen.queryByText("Still there?")).toBeNull();
    expect(idleLogoutAction).not.toHaveBeenCalled();
  });

  it("warns before the limit, then signs out exactly once when it runs out", () => {
    render(<IdleLogout />);

    advance(TIMEOUT_MS - WARNING_MS + 2000);
    expect(screen.getByText("Still there?")).toBeTruthy();
    expect(idleLogoutAction).not.toHaveBeenCalled();

    advance(WARNING_MS + 5000);
    expect(idleLogoutAction).toHaveBeenCalledTimes(1);
  });

  it("treats real activity as a reset, even during the warning", () => {
    render(<IdleLogout />);
    advance(TIMEOUT_MS - 30_000);
    expect(screen.getByText("Still there?")).toBeTruthy();

    fireEvent.keyDown(window);
    advance(2000);
    expect(screen.queryByText("Still there?")).toBeNull();

    advance(TIMEOUT_MS - WARNING_MS - 5000);
    expect(idleLogoutAction).not.toHaveBeenCalled();
  });

  it("the Stay signed in button dismisses the warning and restarts the clock", () => {
    render(<IdleLogout />);
    advance(TIMEOUT_MS - 30_000);

    fireEvent.click(screen.getByRole("button", { name: "Stay signed in" }));
    expect(screen.queryByText("Still there?")).toBeNull();

    advance(TIMEOUT_MS - WARNING_MS - 5000);
    expect(idleLogoutAction).not.toHaveBeenCalled();
  });

  it("counts activity in another tab (shared via localStorage)", () => {
    render(<IdleLogout />);
    advance(TIMEOUT_MS - 10_000);

    window.localStorage.setItem("idle-logout:last-activity", String(Date.now()));
    advance(20_000);

    expect(screen.queryByText("Still there?")).toBeNull();
    expect(idleLogoutAction).not.toHaveBeenCalled();
  });
});
