/** How long the server sign-out gets to navigate away before the browser signs itself out instead. */
export const SERVER_SIGN_OUT_GRACE_MS = 8_000;

export interface IdleSignOutDeps {
  /** The normal route: a server action that signs out, writes the audit log and redirects to the login page. */
  serverSignOut: () => Promise<unknown>;
  /** Fallback: clears the session cookies from the browser. */
  browserSignOut: () => Promise<unknown>;
  goToLogin: () => void;
}

/**
 * Signs the user out after the idle timeout. The server action is tried first, but it can fail - most often a tab left
 * open across a deploy still holds the old build's action id, which the server no longer recognises - and if nothing
 * else happens the user would stay signed in for good. So when the server sign-out fails, or has not navigated away
 * within SERVER_SIGN_OUT_GRACE_MS, the browser clears its own session and goes to the login page.
 */
export function runIdleSignOut({ serverSignOut, browserSignOut, goToLogin }: IdleSignOutDeps): void {
  let fallbackStarted = false;

  async function fallback() {
    if (fallbackStarted) return;
    fallbackStarted = true;
    try {
      await browserSignOut();
    } catch {
      // Even if the browser sign-out fails the login page is the best place to land; the next request is re-checked.
    }
    goToLogin();
  }

  const timer = setTimeout(() => void fallback(), SERVER_SIGN_OUT_GRACE_MS);
  Promise.resolve()
    .then(serverSignOut)
    .catch(() => {
      clearTimeout(timer);
      void fallback();
    });
}
