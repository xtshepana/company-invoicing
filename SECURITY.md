# Security Policy

This is a real business application handling invoicing, payment, and
customer data — please report security issues responsibly rather than
opening a public issue.

## Reporting a vulnerability

Email **smochike@gmail.com** with:

- A description of the issue and its potential impact
- Steps to reproduce it (a minimal example helps a lot)
- Any suggested fix, if you have one

Please don't open a public GitHub issue for anything that could expose
user data, allow privilege escalation, or bypass a security control (RLS
policy, module-permission check, webhook verification, etc.).

You should get an acknowledgement within a few days. Once confirmed,
we'll work on a fix and let you know when it's deployed before any public
disclosure.

## Supported versions

There's a single deployed instance of this app, always running the
latest commit on `master`. There are no older versions to maintain
security fixes for.

## Scope

Architecture-level security controls (RLS as defense in depth, server-side
authorization checks on every server action/route handler, the
credit-ledger/payment-allocation invariants, the `CRON_SECRET`-gated cron
endpoint, and the Postgres function grants documented in the migration
postmortems) are described in `CLAUDE.md`'s architecture rules — a report
that a control described there is missing or bypassable is exactly the
kind of thing this policy is for.
