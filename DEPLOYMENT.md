# Deploying to Hostinger

This covers what's needed for the app as it exists today (Phase 1:
authentication, company settings, users, audit log). It will be extended as
later phases add PDF generation, cron jobs, and email.

## 1. Build the application

```bash
npm run build
```

Fix any typecheck/lint/test/build failures before deploying — see
`SETUP.md` step 5.

## 2. Push code to GitHub

Hostinger's Node.js hosting can deploy from a connected Git repository, or
you can upload a build manually. A Git-based deploy is strongly
recommended so `git push` is your deploy trigger.

## 3. Configure Hostinger Node.js hosting

In hPanel: **Websites > [your site] > Node.js**, create/select an
application, point it at this repository, set:

- **Startup file**: not applicable — Next.js is started via `npm run
  start` after `npm run build`. Set the application's start command to
  `npm run start` (Hostinger's Node.js panel lets you set a custom start
  command).
- **Node.js version**: 20 or later.

## 4. Environment variables

In the Node.js application's environment variables panel, set everything
from `.env.example`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only secret — never expose this)
- `NEXT_PUBLIC_APP_URL` (your production domain, e.g. `https://invoicing.yourcompany.co.za`)
- `CRON_SECRET` (generate a new one for production: `openssl rand -hex 32`)
- `RESEND_API_KEY`, `EMAIL_FROM` (once the email phase ships)

## 5. Database

The Supabase project is already provisioned and migrated — nothing to run
on Hostinger itself for the database (Supabase is hosted separately, not
on Hostinger). If you ever need to re-apply migrations from scratch against
a different Supabase project, run each file in `supabase/migrations/` in
order via the Supabase SQL editor or `supabase db push`.

## 6. Domain and HTTPS

Point your domain at the Hostinger Node.js application (hPanel handles
this under **Domains**) and enable Hostinger's free SSL certificate for it.
Update `NEXT_PUBLIC_APP_URL` to match the final `https://` domain — this is
used to build password-reset and invite email links.

## 7. Cron jobs

`/api/cron/daily` generates due recurring invoices and sends payment
reminder emails. It must run once a day and is protected by `CRON_SECRET`
(the same value set in step 4) — it checks for an exact
`Authorization: Bearer <CRON_SECRET>` header and returns 401 without it.
Running it more than once on the same day is safe: invoice generation is
idempotent per `(recurring_invoice_id, invoice_date)` and reminders are
deduplicated per `(invoice_id, offset_days)`.

**If your plan is classic PHP/shared hosting**, hPanel exposes
**Advanced → Cron Jobs**:

- **Common Settings**: Once Per Day, at a low-traffic hour (e.g. 02:00).
- **Command**: use hPanel's "Send an HTTP request" option if available;
  otherwise use a `curl` command:
  ```bash
  curl -fsS -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/daily
  ```
  Replace `YOUR_CRON_SECRET` with the exact value of `CRON_SECRET` from
  step 4, and the URL with your production `NEXT_PUBLIC_APP_URL`.

**If your plan is Hostinger's Node.js Web App hosting** (GitHub-integrated
deploys, `hbuilds/versions/...` on disk, a "Runtime Logs" panel instead of
classic hPanel tools) — this is the case for most setups following this
guide — **hPanel does not expose Cron Jobs for this hosting type at all**,
even though it's on the same account as other sites that do have it. No
action is needed here: `lib/cron-trigger.ts`'s `maybeTriggerDailyCron()`,
called from the `(app)` layout on every authenticated page load, fires
this job in the background instead. A boot-time timer (the first thing
tried) doesn't work on this host — its Node.js processes run under
LiteSpeed's `lsnode.js`, which cycles processes on a FastCGI-like model
rather than keeping one alive indefinitely, so a `setTimeout`/`setInterval`
scheduled once at startup can't reliably survive long enough to fire.
Riding along on real requests sidesteps that: any staff member loading any
page during the day triggers the check, an in-memory per-process flag
avoids refiring on every navigation, and the job's own idempotency (below)
makes it harmless if multiple short-lived processes each fire it once on
the same day. The tradeoff is it no longer runs at a specific low-traffic
hour — it runs shortly after the first page load of the day instead.

To test manually regardless of which path applies to you:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/daily
```

It returns a JSON summary (`recurringInvoices.generated`, `reminders.sent`,
etc.) — check this after the first scheduled run to confirm it's working.

## 8. Post-deploy verification

1. Visit the production URL — you should land on `/login`.
2. Create the first user from the Supabase dashboard (see `SETUP.md` step 3)
   using your **production** Supabase project, then sign in.
3. Confirm you can open **Settings**, **Users**, and **Audit Log** as the
   Owner/Admin.
4. Invite a second user and confirm the invite email arrives (requires
   Supabase Auth email sending to be configured for your project — SMTP
   settings are under Supabase dashboard > Authentication > Email).

## 9. Startup validation and error logging

`instrumentation.ts`'s `register()` calls `getServerEnv()` once when the
server starts, before it accepts any request — if a required variable
from step 4 is missing (or empty), the server fails to start with a clear
"Missing required environment variable: X" error instead of surfacing as
a confusing 500 on whichever request happens to touch it first. If
Hostinger reports the app failed to start, this is the first thing to
check in its log viewer.

Every uncaught server error (Server Components, Route Handlers, Server
Actions) is also logged there as a structured `[server error]` line via
`onRequestError` in the same file — there's no third-party observability
provider wired up (Sentry, etc.); that's a decision for whoever runs this
in production, not something assumed here.

`next.config.mjs` sets baseline security headers on every response
(`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`,
`Permissions-Policy`, `Strict-Transport-Security`) — no custom
Content-Security-Policy, since a strict CSP needs tuning against actual
script/style sources and risks silently breaking the app.
