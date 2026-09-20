# Company Invoicing System

[![CI](https://github.com/xtshepana/company-invoicing/actions/workflows/ci.yml/badge.svg)](https://github.com/xtshepana/company-invoicing/actions/workflows/ci.yml)

A private, single-company invoicing, payments, and bank reconciliation
application. This is **not** a SaaS product — there is one company profile,
and authorized staff sign in with roles (Owner/Admin, Accountant, Staff).

See `AGENTS.md` for the Next.js 16 breaking-change notes (this project uses
`proxy.ts`, not `middleware.ts` — see the "Architecture notes" section
below), `SETUP.md` for local setup, and `DEPLOYMENT.md` for deploying to
Hostinger. Working on this repo? See `CONTRIBUTING.md`. Found a security
issue? See `SECURITY.md` rather than opening a public issue.

## Stack

- Next.js 16 (App Router) + TypeScript, Tailwind CSS v4, shadcn/ui (Base UI)
- Supabase (Postgres + Auth), Row Level Security
- Zod validation, `decimal.js` for all monetary math
- Resend (transactional email)
- Vitest (unit) + Playwright (e2e)

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run start        # run the production build
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm run test         # vitest run
npm run test:watch   # vitest watch mode
npm run test:e2e     # playwright test
```

## Architecture notes

1. **Never** import `SUPABASE_SERVICE_ROLE_KEY` into a `"use client"` file.
   Server-only access goes through `lib/env.ts` (`getServerEnv()`), which
   fails to import from client code (`server-only` guard).
2. **Row Level Security is defense in depth, not the only check.** Every
   server action / route handler independently verifies the caller via
   `server/services/auth.ts` (`requireUser`, `requireAdmin`,
   `requireAccountingAccess`, `requireModuleAccess`).
3. **Admin authorization is always server-side**, via `requireAdmin()`,
   which checks `profiles.role` through the signed-in user's own session
   (RLS-protected) — never derive admin status from client state.
4. **Audit logging is append-only and admin-read-only.** There is no RLS
   insert/update/delete policy for the `authenticated` role on
   `audit_logs` at all — the only way a row is ever written is via
   `server/services/audit.ts` (`recordAuditLog`), which uses the
   service-role client. See `supabase/migrations/0002_rls.sql`.
5. **System-configurable values** (VAT rate, invoice numbering, payment
   terms, currency, etc.) live in the `company_settings` table and are read
   via `lib/config/system-settings.ts`. `lib/config/defaults.ts` holds
   fallback values only, used if that row is somehow missing. Never
   hard-code these in feature code.
6. **All monetary math goes through `lib/money.ts`** (`decimal.js`-backed).
   Never do financial arithmetic with plain JS numbers.
7. Route protection: `proxy.ts` (Next 16's renamed `middleware.ts`)
   redirects unauthenticated requests away from app routes. Each route
   group's `layout.tsx` re-checks the session server-side — never rely on
   the proxy alone.
8. Roles: `owner_admin` (full access, incl. users/settings/audit log),
   `accountant` (all business modules, not users/settings), `staff`
   (only the modules explicitly enabled in `profiles.staff_module_permissions`).
   The very first user ever created becomes `owner_admin` automatically
   (see `handle_new_auth_user` in `supabase/migrations/0001_init.sql`) —
   there is no public registration.

## Directory structure

```
app/            Next.js App Router routes ((auth) = login/forgot/reset password, (app) = the authenticated shell)
components/     UI components (components/ui = shadcn primitives; layout/, auth/, settings/, users/)
lib/            Shared code: env, supabase clients, config, validations (zod), money.ts
server/         Server-only business logic: services/ (auth, audit, users, dashboard, company-settings) and actions/ (Server Actions)
types/          Hand-written Supabase `Database` type (types/database.ts)
supabase/       SQL migrations, applied in filename order
tests/          tests/unit (Vitest), tests/e2e (Playwright, added as UI features land)
```

## Status

**Phase 1 (done):** project setup, Supabase project + schema (`profiles`,
`company_settings`, `audit_logs`), RLS, authentication (login, logout,
forgot/reset/change password), role-based authorization
(`owner_admin`/`accountant`/`staff` with per-module staff permissions),
admin user management (invite/edit role/activate/deactivate), company
settings (profile, VAT & invoicing, bank details), audit log viewer,
application shell (sidebar/topbar, mobile drawer), dashboard shell.

**Phase 2 (done):** customers (add/edit/archive, search/filter/sort,
customer profile page) and products & services (add/edit/archive, product
vs. service type, VAT rate).

**Phase 3 (done):** quotes and invoices (create/edit/PDF), quote → invoice
conversion, concurrency-safe document numbering, dashboard now shows real
sales/paid/outstanding/overdue figures.

**Phase 4 (done):** payments (full/partial/overpayment), customer credit
ledger + applying credit to another invoice, customer statements
(HTML/PDF/CSV).

**Phase 5 (done):** recurring invoices with pause/resume/cancel/skip-next,
idempotent daily cron generation (`app/api/cron/daily`, see
`DEPLOYMENT.md` for the Hostinger cron panel setup), automatic payment
reminder emails (configurable on/off in Settings), and transactional email
(invoice sent, quote sent, payment receipt, recurring invoice generated,
payment reminder) via Resend — every send is logged to `email_logs`
regardless of outcome.

**Phase 6 (done):** bank statement import (CSV/Excel, with column mapping
and duplicate detection) and reconciliation — link a bank transaction to
an existing payment, create a new payment straight from an unreconciled
transaction, or run automatic matching against already-recorded payments.

**Phase 7 (done):** credit notes (draft → issued → cancelled, feeding the
existing customer credit ledger on issue, PDF + email) and reports — a VAT
report (output VAT for a period, CSV export) and an accounts-receivable
aging report (outstanding balances by customer, bucketed by days overdue,
CSV export). This closes out every module named in the original build
spec's phase list.

**Phase 8 (done):** a Playwright e2e suite (`tests/e2e/`) covering the
full acceptance-test path against a real production build and the real
Supabase project — see `CLAUDE.md` for how to run it (it needs a
dedicated test account bootstrapped once via `scripts/create-e2e-user.mjs`
plus one manual SQL step).

**Phase 9 (done):** a full-database JSON backup/export
(`GET /api/admin/export`, `owner_admin` only), covering every business
table via the service-role client so it bypasses RLS entirely. This is
export-only — there's no restore path — and every download is recorded in
the audit log. Available from Settings → Backup.

**Bank-matching UX polish (done):** the manual "Match" dialog on
`/bank-reconciliation` now suggests outstanding invoices for an
unmatched transaction (by exact-amount balance and/or customer-name
match against the description/reference), one click away from a
pre-filled Record Payment form — closing the gap left by automatic
matching, which only ever links to payments that already exist.

**Performance/accessibility audit (done):** the auth check and company
settings read are now deduplicated per request (React `cache()`), the
dashboard's invoice totals are computed in SQL instead of reducing every
invoice row in JS, and a partial index on `invoices.balance_due` backs
the five places that filter on it. Icon-only controls that had no
accessible name (mobile nav, account menu, remove-line-item,
edit-product, list search) now do, and card-based pages have a real
heading structure a screen reader can navigate by.
