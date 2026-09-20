import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// No dotenv dependency in this repo — .env.local is only auto-loaded by
// Next.js itself, not by the Playwright test runner process, so the setup
// spec (and the webServer's own `npm run dev`) wouldn't see
// E2E_USER_EMAIL/PASSWORD without this. Parsed by hand, same as
// scripts/create-e2e-user.mjs.
function loadDotEnvLocal() {
  const envPath = path.join(__dirname, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] === undefined) {
      process.env[key] = trimmed.slice(eq + 1).trim();
    }
  }
}
loadDotEnvLocal();

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["html", { open: "never" }], ["list"]],
  // Every action here is a real round trip to the production Supabase
  // project (no mocking), plus Next.js dev mode compiles each route on
  // its first hit per server process — the default 5s expect timeout was
  // too tight and produced a false failure on a real form submission that
  // was still genuinely in flight, not stuck.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: {
    // A production build, not `next dev` — dev mode compiles each route
    // on-demand on its first hit, and that first-hit lag (worse for
    // route handlers than pages) was long enough to make several
    // first-time actions in the suite look hung rather than just slow,
    // even past a generous 60s per-test timeout. Building once up front
    // costs a few minutes at suite start but makes every request as fast
    // as it'll be in production.
    command: `npm run build && npx next start --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 300_000,
    // Never let e2e runs send real transactional email through the
    // account's configured Resend key, no matter what .env.local has.
    env: { RESEND_API_KEY: "" },
  },
  projects: [
    {
      name: "setup",
      testMatch: /.*\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], storageState: "playwright/.auth/user.json" },
      dependencies: ["setup"],
    },
  ],
});
