@AGENTS.md

# Company Invoicing System

A private, single-company invoicing, payments, and bank reconciliation
application. **This is not a SaaS product.** One company profile, no
tenants, no subscriptions, no public registration — authorized staff only,
invited by an administrator.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind CSS v4 + shadcn/ui (built on `@base-ui/react` — components use
  the `render` prop, not `asChild`)
- Supabase (Postgres + Auth), Row Level Security
- Zod for validation, `decimal.js` for all monetary math (never plain JS
  number arithmetic for money)
- Resend for transactional email (`lib/email/`, `server/services/email.ts`)
- Vitest (unit) + Playwright (e2e)

## Architecture rules (do not violate)

1. **Never** import `SUPABASE_SERVICE_ROLE_KEY` into a `"use client"` file.
   Server-only access goes through `lib/env.ts` (`getServerEnv()`), which
   fails to import from client code.
2. **Row Level Security is defense in depth, not the only check.** Every
   server action / route handler independently verifies the caller via
   `server/services/auth.ts` (`requireUser`, `requireAdmin`,
   `requireAccountingAccess`, `requireModuleAccess`).
3. **Admin authorization is always server-side**, via `requireAdmin()`,
   which reads `profiles.role` for the signed-in user. Never derive admin
   status from client state, a cookie, or a JWT claim.
4. **Audit logging is append-only and admin-read-only.** There is no RLS
   insert/update/delete policy for the `authenticated` role on
   `audit_logs` — the only writer is `server/services/audit.ts`
   (`recordAuditLog`), which uses the service-role client. See
   `supabase/migrations/0002_rls.sql`.
5. **System-configurable values** (VAT rate, invoice numbering, payment
   terms, currency, etc.) live in the `company_settings` table, read via
   `lib/config/system-settings.ts`. `lib/config/defaults.ts` holds fallback
   values only. Never hard-code these in feature code.
6. **All monetary math goes through `lib/money.ts`.** Subtotal + VAT -
   discount must always reconcile to the total; see
   `calculateLineTotals`/`sumLineTotals` and their tests in
   `tests/unit/money.test.ts`.
7. Route protection: `proxy.ts` (Next 16's renamed `middleware.ts`)
   redirects unauthenticated requests away from app routes. Each `(app)`
   route's page/layout re-checks the session server-side — never rely on
   the proxy alone. `/api/*` is excluded from the proxy matcher; cron/
   webhook routes (added in later phases) do their own auth.
8. **Roles**: `owner_admin` (full access, incl. Users/Settings/Audit Log),
   `accountant` (all business modules, not Users/Settings), `staff` (only
   modules explicitly enabled in `profiles.staff_module_permissions`, see
   `StaffModule` in `server/services/auth.ts`). The very first user ever
   created becomes `owner_admin` automatically (`handle_new_auth_user` in
   `0001_init.sql`) — there is no public registration; every subsequent
   user is invited from `/users`.
9. **Financial records are never destructively deleted once finalized** —
   use void/cancel/credit-note patterns instead (this rule takes full
   effect once invoices/quotes exist in a later phase).
10. Provider abstractions (payments not applicable — no online payment
    gateway in this app) go behind an interface so a provider can be
    swapped without touching feature code, matching the pattern used for
    `lib/ai/`/`lib/payments/` in other projects on this machine. Email is
    the one place this applies here: `server/services/email.ts`
    (`sendEmail`) wraps `lib/email/resend-client.ts`
    (`getResendClient()` — returns `null`, not a throw, when
    `RESEND_API_KEY` is unset) so feature code never talks to Resend
    directly and every send attempt (sent/failed/skipped) is logged to
    `email_logs`.
11. **Cron endpoints are the only caller of service-role-only RPCs.**
    `app/api/cron/daily/route.ts` checks `Authorization: Bearer
    <CRON_SECRET>` itself (like every other route under `/api/*`, which
    `proxy.ts` does not cover) and uses `createAdminSupabaseClient()`
    throughout, since there is no `auth.uid()` in a cron invocation.
    `generate_recurring_invoice()` is granted to `service_role` only for
    the same reason — an ordinary signed-in user cannot call it even if
    they know the RPC name.

## Directory structure

```
app/            Next.js App Router routes ((auth) = login/forgot/reset password, (app) = the authenticated shell, api/pdf + api/cron + api/bank-transactions + api/reports = route handlers outside proxy.ts)
components/     UI components (components/ui = shadcn primitives; layout/, auth/, settings/, users/, documents/, bank/, credit-notes/)
lib/            Shared code: env (env.ts server-only / env-public.ts), supabase/ clients, config/, validations/ (zod), money.ts, documents.ts, email/ (resend-client, templates), pdf/ (per-document *-pdf.tsx + render-*.tsx wrappers for use from plain .ts server actions), bank-import/ (client-side file parsing + column-mapping normalization, kept dependency-free of the server)
server/         Server-only business logic: services/ (auth, audit, email, users, dashboard, company-settings, audit-log-query, customers, products, quotes, invoices, payments, statements, recurring-invoices, bank-transactions, credit-notes, reports, backup) and actions/ (Server Actions)
types/          Hand-written Supabase `Database` type (types/database.ts)
supabase/       SQL migrations, applied in filename order
tests/          tests/unit (Vitest), tests/e2e (Playwright, added as UI features land)
```

## Commands

```bash
npm run dev            # start dev server
npm run build           # production build
npm run lint             # eslint
npm run typecheck        # tsc --noEmit
npm run test              # vitest run
npm run test:watch        # vitest watch mode
npm run test:e2e           # playwright test — see "e2e tests" below before running
```

### e2e tests

`playwright.config.ts` builds the app and runs it via `next start` (not
`next dev`) — dev mode compiles each route on its first hit, and that lag
was long enough to make several genuine first-time actions in the suite
look hung rather than slow, even past a generous per-test timeout. This
costs a few minutes at suite start but every request is then as fast as
production.

Requires a dedicated Supabase auth user: run
`node scripts/create-e2e-user.mjs` once (reads `E2E_USER_EMAIL`/
`E2E_USER_PASSWORD` from `.env.local`, creating both if unset — generate a
real password rather than committing a placeholder), and promote its
profile to `owner_admin` once via direct SQL (`alter table profiles
disable trigger profiles_prevent_self_privilege_escalation; update
profiles set role = 'owner_admin', is_active = true where id = '<id>';
alter table profiles enable trigger ...`) — the app's own role-change path
always requires a real admin's authenticated session, which a standalone
script doesn't have, so this one-time bootstrap step can't go through the
normal UI/action path. Never point this account at a real staff member.

Every spec creates its own uniquely-named customer(s) (`E2E Customer
<timestamp>`, etc.) rather than touching the curated "ABC Technologies"
fixture, and none of it is cleaned up automatically — after a real run,
sweep it manually (`delete ... where company_name like 'E2E%'`, matching
`bank_transactions.reference like 'E2ETXN%'` and
`bank_import_batches.filename = 'e2e-statement.csv'`, respecting FK order:
`payment_allocations` → `customer_credits` → `credit_notes` → `payments` →
`invoices` → `recurring_invoice_items` → `recurring_invoices` →
`bank_transactions` → `bank_import_batches` → `customers` last).

## Database

- `0001_init.sql` — extensions, `user_role` enum, `profiles` (+ auto-create
  trigger, first user = owner_admin), `company_settings` (singleton row),
  `audit_logs`
- `0002_rls.sql` — `is_admin()`/`is_active_staff()`/`current_role_name()`
  helpers, RLS policies, a trigger blocking self-privilege-escalation on
  `profiles`
- `0003_harden_functions.sql` — fixes a mutable search_path advisory and
  revokes unnecessary RPC execute grants
- `0004_fix_handle_new_user_enum_cast.sql` — casts the role literal to
  `user_role` in `handle_new_auth_user` (see bug postmortem below)
- `0005_customers_and_products.sql` / `0006_customers_products_rls.sql`
- `0007_quotes_and_invoices.sql` / `0008_quotes_invoices_rls.sql`
- `0009_document_write_functions.sql` — atomic `create_quote`/`update_quote`/
  `create_invoice`/`update_invoice`/`convert_quote_to_invoice`
- `0010_payments.sql` / `0011_payments_rls.sql`
- `0012_payment_functions.sql` — `record_payment`/`apply_customer_credit`
- `0013_harden_rpc_grants.sql` — revoke-from-PUBLIC fix (see postmortem #1)
- `0014_fix_payment_status_enum_cast.sql` — enum-CASE fix (see postmortem #2)
- `0015_recurring_invoices.sql` — `recurring_invoices`,
  `recurring_invoice_items`, `email_logs`, `invoice_reminders_sent`,
  `company_settings.payment_reminders_enabled`
- `0016_recurring_invoices_rls.sql`
- `0017_recurring_invoice_functions.sql` — `create_recurring_invoice`/
  `update_recurring_invoice`/`skip_next_recurring_invoice`/
  `generate_recurring_invoice` (idempotent, service_role-only)
- `0018_fix_recurring_invoice_grants.sql` — explicit `revoke ... from anon`
  by name (see postmortem #3 — a *different* grants bug than #1)
- `0019_fix_recurring_invoice_numbering.sql` — inlines invoice-number
  generation into `generate_recurring_invoice` instead of calling
  `next_invoice_number()` (see postmortem #5)
- `0020_bank_reconciliation.sql` — `bank_import_batches`, `bank_transactions`
  (+ `bank_transaction_status` enum), `import_bank_transactions`/
  `match_bank_transaction`/`unmatch_bank_transaction`/
  `auto_match_bank_transactions`, and `record_payment` gains `p_source`/
  `p_bank_transaction_id` (drop + recreate, since Postgres treats a changed
  parameter list as a new overload rather than a replacement)
- `0021_credit_notes.sql` — `credit_notes`, `credit_note_items` (+
  `credit_note_status` enum), `customer_credits.credit_note_id`,
  `next_credit_note_number`/`create_credit_note`/`update_credit_note`/
  `issue_credit_note`/`void_credit_note`
- `0022_fix_record_payment_enum_cast_again.sql` — restores the
  `::public.invoice_status` cast that 0020's drop+recreate of
  `record_payment` accidentally dropped (see postmortem #6)

Supabase project ref: `wmsrbfnnpmbrbbhollxo` (see `SETUP.md` for the
service-role key you still need to add to `.env.local` — it can't be
fetched via tooling for security reasons).

## Status

**Phase 1 done:** project setup, Supabase schema + RLS, authentication
(login/logout/forgot/reset/change password), role-based authorization,
admin user management, company settings (profile/VAT/invoicing/bank
details), audit log viewer, app shell (responsive sidebar + mobile drawer),
dashboard shell.

**Phase 2 done:** customers (full CRUD, search/filter/sort/paginate,
archive instead of delete, profile page with placeholders for
invoice/payment totals until those phases exist) and products & services
(dialog-based CRUD, product vs. service type, VAT rate defaults from
company settings). `server/services/{customers,products}.ts` +
`server/actions/{customer,product}-actions.ts`; schema in
`0005_customers_and_products.sql` / RLS in `0006_customers_products_rls.sql`
via the reusable `has_module_access(module)` helper.

**Phase 3 done:** quotes and invoices, with PDF generation
(`@react-pdf/renderer`, `/api/pdf/{quotes,invoices}/[id]` route handlers —
these are outside `proxy.ts`'s matcher, so each does its own
`getCurrentProfile()`/`hasModuleAccess()` check). Header+line-items writes
go through atomic Postgres functions (`create_quote`/`update_quote`/
`create_invoice`/`update_invoice`/`convert_quote_to_invoice` in
`0009_document_write_functions.sql`) rather than sequential client calls,
so a line-item insert failure can't leave an orphaned header row.
Concurrency-safe numbering via `next_quote_number()`/`next_invoice_number()`
(row-lock UPDATE...RETURNING on the single `company_settings` row).
`lib/documents.ts` (`computeDocumentTotals`) is the one place quote/invoice
totals get computed from line items — both share it so they can never
diverge. Quotes can be converted to invoices (copies line items exactly,
links via `quotes.converted_invoice_id`, quote becomes read-only after).
Invoices can't be edited/cancelled/voided once `amount_paid > 0` — enforced
in the SQL functions themselves, not just the UI.

**Phase 4 done:** payments (full/partial/overpayment), a customer credit
ledger (`customer_credits` — signed amounts, never a single balance
column), applying existing credit to a different invoice, and customer
statements (HTML view, PDF, CSV — a running Date/Reference/Description/
Debit/Credit/Balance ledger). `record_payment()` and
`apply_customer_credit()` in `0012_payment_functions.sql` (fixed in
`0014_...`, see below) are atomic and re-validate everything server-side:
allocation ≤ payment amount, allocation ≤ invoice's *current* balance_due
(row-locked with `for update` to close a concurrent-double-allocation
race), invoice belongs to the claimed customer, invoice isn't
cancelled/void. `payments`/`payment_allocations`/`customer_credits` are
append-only by RLS design — no update/delete policy exists for anyone; a
mistake gets corrected with a new ledger entry, never a mutation.
`getCustomerStatement()` in `server/services/statements.ts` treats only
invoices and payments as balance-affecting events — a credit application
moves money the statement already counted when the original overpayment
came in, so it deliberately does not get its own line (that took a moment
to reason through; see the comment there before "fixing" it into a
3-line-per-payment statement).

**Phase 5 done:** recurring invoices (weekly/monthly/every-2-months/
quarterly/every-6-months/annually/custom-interval-days, pause/resume/
cancel/skip-next, `recurring-invoice-form.tsx` +
`recurring-invoice-actions-bar.tsx`) with idempotent cron-driven generation
(`app/api/cron/daily/route.ts`, `Authorization: Bearer <CRON_SECRET>`,
documented for Hostinger's cron panel in `DEPLOYMENT.md`), payment
reminder emails (`REMINDER_OFFSET_DAYS = [-7, 0, 7, 14, 30]` in
`lib/config/defaults.ts`, deduplicated via the `(invoice_id, offset_days)`
unique constraint on `invoice_reminders_sent`, gated by the new
`company_settings.payment_reminders_enabled` toggle on the Settings →
"VAT & invoicing" tab), and transactional email wired into the three
places that were previously silent: `markInvoiceSentAction` (invoice
sent), `setQuoteStatusAction` when status becomes `sent` (quote sent), and
`recordPaymentAction` (payment receipt) — each PDF-attaching email uses
the service-role client to fetch the customer regardless of whether the
staff member performing the action also has the `customers` module
enabled, since sending a transactional receipt shouldn't be gated by that.
`sendEmail()` never throws and always logs to `email_logs`
(`sent`/`failed`/`skipped`), so an unconfigured `RESEND_API_KEY` degrades
to "skipped" everywhere rather than breaking the underlying action — used
deliberately during Phase 5 verification (dev server started with
`RESEND_API_KEY=` overridden empty) to exercise the full cron/email code
path against real fixture data without actually sending mail through the
account's configured Resend key.

**Phase 6 done:** bank statement import (CSV and Excel, via `papaparse`/
`exceljs` — both were already dependencies before this phase, evidently
provisioned for it in advance) and reconciliation. The import wizard
(`components/bank/import-wizard.tsx`) parses the file entirely client-side
for the column-mapping/preview step (nothing is uploaded until the user
confirms the mapping), guesses each column's role from its header text,
supports either a single signed Amount column or separate Debit/Credit
columns, and lets the user pick the date format and invert amounts for
statements that export deposits as negative. `import_bank_transactions()`
computes a per-row `dedupe_hash` server-side (never trusting a
client-supplied one) so re-importing an overlapping statement silently
skips rows already seen instead of duplicating them.

Reconciliation never bypasses `record_payment()` — a bank transaction is
either **linked to a payment that already exists** (`match_bank_transaction`/
`unmatch_bank_transaction`, for the common case where staff capture a
payment as soon as a customer says they've paid, then later confirm it
cleared) or used to **create a brand-new payment directly** (the
`payments.source` column, already present since Phase 4 as a `'manual'`-
default text field — evidently also provisioned in advance — now takes
`'bank_reconciliation'`; `record_payment()` gained two optional trailing
params, `p_source` and `p_bank_transaction_id`, so linking happens
atomically in the same call that creates the payment). `/payments/new` now
accepts `?bank_transaction_id=&amount=&date=&reference=&description=` to
prefill the Record Payment form from an unreconciled transaction (amount
locked read-only — the bank feed is authoritative on that, not the user).
`auto_match_bank_transactions()` only ever links to *existing* payments
(exact amount, within a 3-day window, closest date wins) — it can never
misfire into a wrong invoice allocation, since it never creates a payment
itself. The `"banking"` staff module, its nav item's dashboard-card
placeholder, and the `Users` page's module-permission checkbox were all
already wired in from Phase 1 with nothing pointing at them yet — this
phase is what turns them on.

**Phase 7 done:** credit notes and reports (VAT, accounts-receivable
aging). A credit note is a full numbered document (line items, VAT
breakdown, optional reference invoice, PDF, email-on-issue) that only
takes effect on the customer's balance at the moment it's **issued** —
`create_credit_note`/`update_credit_note` leave it as an inert `draft`
with zero ledger impact; `issue_credit_note()` is the one function that
inserts into `customer_credits` (`source = 'credit_note'`, an enum value
that had sat unused since `0010_payments.sql`). Deliberately does **not**
add any new "apply this credit to an invoice" mechanism — issuing just
adds to the customer's pooled credit balance, and `apply_customer_credit()`
(Phase 4) is what moves it onto an invoice, completely unmodified. This
was verified live end-to-end: issuing a credit note updated the same
credit-balance figure the customer page already showed, and applying it
through the pre-existing "Apply Credit" dialog worked with zero code
changes on that side. `void_credit_note()` mirrors the same
already-spent-or-not check as bank reconciliation's ledger reasoning: a
`draft` cancels for free, but an `issued` one can only be voided while the
customer's *current* balance still covers it (pooled/fungible, not traced
per-credit-note) — confirmed live that voiding a fully-applied credit note
is correctly refused.

Reports are read-only, current-data pages (no caching/snapshotting) under
the `"reports"` staff module: `/reports/vat` (output VAT only — this app
has no expense/purchase tracking, so there's no input VAT to net against;
period totals plus a per-document detail table, invoice-date/accrual
basis) and `/reports/aging` (accounts-receivable balances bucketed into
Current/1-30/31-60/61-90/90+ days overdue, by customer). Both have a
`.csv` export route (`/api/reports/{vat,aging}.csv`) using the same
inline `csvEscape()` pattern as the existing statement CSV route. Date
filtering is a plain `<form method="get">` with `<input type="date">` —
no client JS at all, since a server component re-fetching on a query-param
change is simpler than wiring up a client-side date picker for something
this basic.

**Phase 8 done:** a Playwright e2e suite (`tests/e2e/`) covering the
acceptance-test golden path end to end against a real production build and
the real Supabase project (no mocking) — customer → invoice → mark sent →
record + allocate a payment → paid → credit note → issued → credit balance
→ statement (`core-workflow.spec.ts`); recurring invoice create/skip/
pause/resume/cancel (`recurring-invoices.spec.ts`); bank statement import,
duplicate detection, and ignore/restore (`bank-reconciliation.spec.ts`);
and both reports rendering plus their CSV exports (`reports.spec.ts`).
`scripts/create-e2e-user.mjs` bootstraps a dedicated `owner_admin` test
account (see "e2e tests" above for the one manual SQL step it can't do
itself). Getting this green surfaced a real regression (postmortem #6)
that no manual click-through or unit test had exercised.

**Phase 9 done:** a full-database JSON export for disaster recovery
(`GET /api/admin/export`, `owner_admin` only — checked directly with
`getCurrentProfile()`, same pattern as the PDF/CSV export routes, not the
throwing `requireAdmin()` helper, so the route controls its own 401 vs 403).
`server/services/backup.ts` reads every business table via the
service-role client (the one legitimate reason to bypass RLS and module
permissions entirely) and returns one JSON file. Export-only — there's no
restore path, matching what was actually asked for rather than building a
speculative import pipeline nothing exercises. Surfaced on Settings → a
new "Backup" tab. Every export is itself audit-logged
(`backup.exported`), same as any other admin action.

**Bank-matching UX polish (done):** `auto_match_bank_transactions` only
ever links a transaction to a payment that *already exists* — it has
nothing to offer for a transaction that arrived before anyone captured
the payment. `listCandidateInvoices()` in
`server/services/bank-transactions.ts` closes that gap on the manual
"Match" dialog: it suggests outstanding invoices whose balance equals the
transaction amount and/or whose customer name shows up in the
transaction's description/reference (a heuristic — see
`customerNameAppearsIn()` — surfaced as a suggestion to confirm, never
auto-applied). The dialog's "Suggested invoices" section links straight
into `/payments/new` with the right customer pre-selected, instead of the
blind customer search that was the only option before. Also fetched via
the existing `/api/bank-transactions/[id]/candidates` route (now returns
both `candidates` and `invoiceCandidates` in one round trip).

See the phase list in the original build spec — this closes out every
module it named.

**Real bugs found only by actually clicking through the app or reasoning
through call sites, not by review:**
1. `revoke execute on function ... from anon` does **not** work the way it
   looks like it should — Postgres grants EXECUTE to `PUBLIC` by default,
   and every role (including `anon`) implicitly inherits `PUBLIC`'s
   privileges. Revoking from `anon` alone leaves the function fully
   callable by anon via the PUBLIC grant; `has_function_privilege('anon',
   ...)` proved it. Fixed in `0013_harden_rpc_grants.sql`: revoke from
   `PUBLIC`, then grant back to `authenticated` explicitly. **Any future
   migration that locks down a SECURITY DEFINER function must revoke from
   PUBLIC, not (only) anon** — grep past migrations before assuming the
   pattern there was correct; 0003 got this right (revoked from `public,
   anon, authenticated` together), 0007/0009/0012 didn't.
2. The exact same enum-CASE bug as `0004_fix_handle_new_user_enum_cast.sql`
   recurred inside `record_payment`'s and `apply_customer_credit`'s
   invoice-status UPDATE (`CASE WHEN ... THEN 'paid' ELSE 'partially_paid'
   END` resolves to `text`, not `invoice_status`, and Postgres won't
   implicitly cast it into the column). Fixed in
   `0014_fix_payment_status_enum_cast.sql` by wrapping the whole CASE in
   `(...)::public.invoice_status`. **Any bare CASE expression assigned to
   an enum column needs an explicit cast — this is now a pattern to check
   for by grep (`case when`) whenever adding a new status-setting
   function**, since it silently passes typecheck/lint and only fails at
   actual runtime execution.
3. A *different* grants bug than #1, found while hardening
   `generate_recurring_invoice` in Phase 5:
   `has_function_privilege('anon', 'generate_recurring_invoice(...)',
   'execute')` returned `true` despite `0017_recurring_invoice_functions.sql`
   already doing `revoke execute on function ... from public` at its tail —
   the exact fix that worked for #1. Root cause, confirmed via direct
   `select proacl from pg_proc where proname = '...'` inspection: Supabase's
   `public` schema has *default privileges* that grant EXECUTE directly to
   `anon`/`authenticated` **by name**, at function-`CREATE`/`REPLACE` time —
   a separate mechanism from the `PUBLIC` pseudo-role that
   `revoke ... from public` touches. `revoke from public` never reaches
   this grant. Fixed in `0018_fix_recurring_invoice_grants.sql` with an
   explicit `revoke execute on function ... from anon` by name. **The
   working rule is now: always revoke from `anon` (and `authenticated` for
   service-role-only functions) by name explicitly, and verify with a
   direct `proacl` query — never trust `revoke ... from public` alone, and
   never trust the Supabase advisor's WARN-level flags as proof a function
   is actually locked down.**
4. `dateDiffInDays` in the Phase 5 cron route was initially written with
   swapped sign semantics: `paymentReminderEmail()` treats a *negative*
   `offsetDays` as "due in N days" and *positive* as "N days overdue" (i.e.
   `offsetDays = today − due_date`), but the first draft computed
   `due_date − today` and tried to fix it with a trailing `* -1`, which
   didn't. Caught by tracing the call site against the template's own
   branching logic before running it, not by a type error — the bug was
   fully type-correct. Fixed by making the helper return a plain
   `to − from` and calling it as `dateDiffInDays(due_date, today)`.
5. `generate_recurring_invoice()` — designed from the start to run with no
   `auth.uid()` (cron/service-role context, see its own comment in
   `0017_recurring_invoice_functions.sql`) — called `next_invoice_number()`
   to get the invoice number, but `next_invoice_number()` opens with
   `if not has_module_access('invoices') then raise exception`, and
   `has_module_access()` looks up `auth.uid()` in `profiles`. With no
   `auth.uid()`, that lookup is always null → always false → the call
   always failed with "You do not have access to the invoices module."
   Every type/lint/build/test check passed because this is a runtime
   authorization failure, not a type error — only caught by actually
   creating a due recurring invoice and hitting `/api/cron/daily` for
   real. Fixed in `0019_fix_recurring_invoice_numbering.sql` by inlining
   `next_invoice_number()`'s row-locked `UPDATE ... RETURNING` directly
   into `generate_recurring_invoice()`, so it no longer depends on any
   auth-gated helper; `next_invoice_number()` itself is untouched and
   still gated for its normal caller (`create_invoice`, run by a signed-in
   user). **General lesson: a SECURITY DEFINER function written to run
   without `auth.uid()` must not transitively call another function that
   assumes one exists** — grep the callee chain for `has_module_access`/
   `auth.uid()` whenever adding a new service-role-only entry point.
   Separately, `createRecurringInvoiceAction`/`updateRecurringInvoiceAction`
   passed line items straight from the form to `create_recurring_invoice`/
   `update_recurring_invoice`, which insert `sort_order` from the jsonb —
   but nothing added a `sort_order` field client-side (unlike invoices/
   quotes, where `computeDocumentTotals()` adds it as part of computing
   totals; recurring templates have no totals to compute yet, so nothing
   played that role), so every create/update failed a not-null constraint.
   Fixed with a `withSortOrder()` helper in `recurring-invoice-actions.ts`.
6. `0020_bank_reconciliation.sql` dropped and recreated `record_payment()`
   to add its two new trailing params (`p_source`, `p_bank_transaction_id`
   — a required drop+recreate, not a plain `create or replace`, since
   Postgres treats a changed parameter list as a new overload rather than
   a replacement). The rewrite was based on the function's *original*
   0012 body, not the 0014-patched one — silently reintroducing the exact
   enum-CASE bug 0014 had already fixed once (`column "status" is of type
   invoice_status but expression is of type text` on the invoice-status
   UPDATE). Every manual Phase 6 test of `record_payment()` used an
   *unallocated* payment, which skips that code path entirely, so the
   regression sat live and undetected until the Phase 8 Playwright suite
   exercised an allocated payment (auto-allocate to an invoice) for the
   first time. No real payment was ever affected — nothing hit this path
   between the regression and the fix. Fixed in
   `0022_fix_record_payment_enum_cast_again.sql`. **General lesson: a
   migration that drops and recreates a function to change its signature
   must diff against that function's most recently patched body, not
   whatever version of it happens to be at hand — grep the full migration
   history for the function name first, every time.** This is also, on its
   own, a case for why the e2e suite exists at all: it is the only thing
   in this project that exercises an allocated payment end to end; the
   unit tests validate the zod schema, not the RPC, and no manual
   click-through session ever happened to test that specific combination
   after Phase 6 shipped.

**Test fixtures already in the live DB** (left in place on purpose, not
cleanup debt): customer "ABC Technologies" with a R125 credit balance,
product "Monthly IT Support", `INV-000003` (Paid, R2,875, fully covered by
a R1,000 partial payment + R1,875 from an overpayment that also produced
the R125 credit), `INV-000002` (Partially Paid, R125 covered by that
credit, R5,625 outstanding), `INV-000001` (Void). Two payments recorded
(R1,000 fully allocated, R2,000 partially allocated + credit). This is a
deliberately populated scenario for exercising Phase 5+ features against
(reminders on an overdue invoice, statements, etc.) — don't "clean it up"
without checking CLAUDE.md history first.

**Known follow-up (not urgent):** Supabase's "leaked password protection"
(HaveIBeenPwned check) is disabled — a dashboard-only toggle under
Authentication > Policies, not something migrations can set.

**Base UI gotchas hit so far** (shadcn on `@base-ui/react`, not Radix):
- Use the `render` prop, not `asChild`.
- `<Button render={<Link .../>}>` needs `nativeButton={false}` or Base UI
  throws a console error (Link renders `<a>`, not `<button>`).
- `DropdownMenuLabel` needs a `Menu.Group` ancestor even standalone — fixed
  once in `components/ui/dropdown-menu.tsx`, don't re-break it.
- A controlled `<Select>` needs an `items` prop (`{value: label}` map) or
  `<SelectValue>` shows the raw value instead of the item's label until the
  popup has been opened once.
- Browser-automation gotcha (not a code bug, but cost real time twice now):
  a Base UI `<Select>` popup's rendered `[role="option"]` elements can
  report a `getBoundingClientRect()` of all zeros even while genuinely open
  and interactive — `computer.left_click` on the element then fails
  ("outside the viewport"). Clicking by coordinate or `scroll_to` doesn't
  fix it. What works: dispatch a real pointerdown/mousedown/pointerup/
  mouseup/click sequence on the option element directly via
  `javascript_tool` — Base UI's own handlers respond to that regardless of
  the element's reported layout size.
- Playwright locator gotcha, cost real time three times while writing the
  Phase 8 e2e suite: `<Button render={<a href={...} />} nativeButton={false}>`
  always reports **`role="button"`** in the accessibility tree, never
  `role="link"`, regardless of the underlying `<a>` tag — Base UI sets the
  ARIA role explicitly to match the component's semantics, not the
  rendered element. `page.getByRole("link", ...)` silently never matches
  these (e.g. "Export CSV", "Statement", "Go to Reconciliation"); always
  use `getByRole("button", ...)` for any `<Button render={<a/>}>` or
  `<Button render={<Link/>}>`, even when it navigates like a link.
- `CardTitle`/`CardDescription` (`components/ui/card.tsx`) render as plain
  `<div>`s, not `<h2>`/`<h3>`/`<p>` — they carry **no heading role at
  all**. `getByRole("heading", ...)` never matches a card's title; use
  `getByText(..., { exact: true })` instead. Only an actual page `<h1>`
  (every detail page's own title) is a real heading.
