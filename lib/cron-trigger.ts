import "server-only";
import { getServerEnv } from "@/lib/env";

let lastTriggeredDate: string | null = null;

/**
 * Hostinger's Node.js hosting runs this app through LiteSpeed's lsnode.js,
 * which cycles Node processes on a FastCGI-like model rather than keeping
 * one alive indefinitely (confirmed live: repeated "Ready" -> "Server is
 * not running" cycles seconds apart) - a setTimeout/setInterval scheduled
 * once at boot can't reliably survive long enough to ever fire there.
 *
 * Instead, this rides along on real incoming requests: any authenticated
 * page load calls this, and it fires the daily job in the background the
 * first time it's called each day (per process - the in-memory guard below
 * is a cheap "don't refetch on every page navigation" optimization, not a
 * correctness requirement). /api/cron/daily is fully idempotent, so firing
 * it redundantly across multiple short-lived processes on the same day is
 * harmless.
 */
export function maybeTriggerDailyCron(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (lastTriggeredDate === today) return;
  lastTriggeredDate = today;

  const env = getServerEnv();
  fetch(`${env.APP_URL}/api/cron/daily`, {
    headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
  })
    .then(async (res) => {
      console.log("[daily-cron] triggered (request-driven)", res.status, await res.text());
    })
    .catch((err) => {
      console.error("[daily-cron] failed to trigger", err instanceof Error ? err.message : err);
    });
}
