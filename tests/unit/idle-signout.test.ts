import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runIdleSignOut, SERVER_SIGN_OUT_GRACE_MS } from "@/lib/idle-signout";

function setup(serverSignOut: () => Promise<unknown>, browserSignOut: () => Promise<unknown> = async () => undefined) {
  const calls: string[] = [];
  runIdleSignOut({
    serverSignOut: async () => {
      calls.push("server");
      return serverSignOut();
    },
    browserSignOut: async () => {
      calls.push("browser");
      return browserSignOut();
    },
    goToLogin: () => {
      calls.push("login");
    },
  });
  return calls;
}

describe("runIdleSignOut", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("tries the server sign-out first and leaves the navigation to it", async () => {
    // The real action redirects, so the page is gone before the grace period ends; here it never settles.
    const calls = setup(() => new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(SERVER_SIGN_OUT_GRACE_MS - 1);
    expect(calls).toEqual(["server"]);
  });

  it("signs out from the browser straight away when the server sign-out fails (stale action id after a deploy)", async () => {
    const calls = setup(() => Promise.reject(new Error("Failed to find Server Action")));
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["server", "browser", "login"]);
  });

  it("falls back when the server sign-out never navigates away", async () => {
    const calls = setup(() => new Promise(() => undefined));
    await vi.advanceTimersByTimeAsync(SERVER_SIGN_OUT_GRACE_MS);
    expect(calls).toEqual(["server", "browser", "login"]);
  });

  it("still goes to the login page if the browser sign-out also fails", async () => {
    const calls = setup(
      () => Promise.reject(new Error("offline")),
      () => Promise.reject(new Error("offline"))
    );
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toEqual(["server", "browser", "login"]);
  });

  it("runs the fallback only once when the server fails and the timer would also have fired", async () => {
    const calls = setup(() => Promise.reject(new Error("boom")));
    await vi.advanceTimersByTimeAsync(SERVER_SIGN_OUT_GRACE_MS * 3);
    expect(calls.filter((call) => call === "browser")).toHaveLength(1);
    expect(calls.filter((call) => call === "login")).toHaveLength(1);
  });
});
