import type { Instrumentation } from "next";

/**
 * Runs once when a server instance starts, before it accepts any request.
 * getServerEnv() throws on a missing required var (SUPABASE_SERVICE_ROLE_KEY,
 * CRON_SECRET, etc.) — calling it here means a misconfigured production
 * deploy fails at boot with a clear error, instead of surfacing as a
 * confusing 500 on whichever request happens to touch that var first.
 * Guarded to the Node.js runtime since proxy.ts (the only edge-runtime
 * code in this app) only ever reads the public env vars, not these.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { getServerEnv } = await import("@/lib/env");
    const env = getServerEnv();

    // Hostinger's Node.js Web App hosting (unlike its classic PHP/shared
    // hosting) doesn't expose hPanel's Cron Jobs feature at all. The server
    // still runs as one persistent process either way, so the daily job is
    // scheduled in-process instead of depending on an external trigger.
    // This calls the existing /api/cron/daily route over HTTP rather than
    // importing its logic directly, so this stays a thin trigger and the
    // route's own idempotency (see that file) is what makes it safe to
    // call repeatedly - including from multiple server instances, if this
    // ever runs on more than one. Gated to production so `npm run dev`
    // never fires real invoice generation/reminder emails on a whim.
    if (process.env.NODE_ENV === "production") {
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;
      const triggerDailyCron = async () => {
        try {
          const res = await fetch(`${env.APP_URL}/api/cron/daily`, {
            headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
          });
          console.log("[daily-cron] triggered", res.status, await res.text());
        } catch (err) {
          console.error("[daily-cron] failed to trigger", err instanceof Error ? err.message : err);
        }
      };
      setTimeout(triggerDailyCron, 30_000);
      setInterval(triggerDailyCron, ONE_DAY_MS);
    }
  }
}

/**
 * Every uncaught server error (Server Components, Route Handlers, Server
 * Actions) flows through here — this app has no third-party observability
 * provider wired up, so this is a plain structured console.error rather
 * than a call to Sentry/etc. Adding a paid provider is a decision for
 * whoever runs this app in production, not something to wire up silently;
 * this at least makes errors show up consistently in Hostinger's log
 * viewer with enough context (path/method/route) to act on.
 */
export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  const message = error instanceof Error ? error.message : String(error);
  const digest =
    typeof error === "object" && error !== null && "digest" in error ? String(error.digest) : undefined;

  console.error("[server error]", {
    message,
    digest,
    path: request.path,
    method: request.method,
    routeType: context.routeType,
    routePath: context.routePath,
  });
};
