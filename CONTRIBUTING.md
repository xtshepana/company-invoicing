# Contributing

This is a private, proprietary codebase (see `LICENSE`) for a
single-company internal tool — it isn't open to public contributions.
This guide is for the team working on it.

## Before you start

1. Follow `SETUP.md` to get a local environment running.
2. Read `CLAUDE.md` — it documents the architecture rules, the full
   migration history (with postmortems on real bugs found along the way),
   and known gotchas. Most "why is this written this way?" questions are
   answered there.

## Making a change

- Branch off `master`, open a PR against it. `.github/workflows/ci.yml`
  runs on every push and PR — typecheck, lint, unit tests, and a
  production build all have to pass.
- Before opening a PR, run the same four checks locally:
  ```bash
  npm run typecheck
  npm run lint
  npm run test
  npm run build
  ```
- If your change touches a page or component with a visible UI effect,
  check it in the browser too — the checks above don't verify that
  anything actually looks or works right, only that it compiles and the
  existing tests still pass.
- If your change is easy to cover in `tests/e2e/`, add or extend a spec —
  see "e2e tests" in `CLAUDE.md` for the one-time setup it needs
  (a dedicated test account) before you can run it locally.

## Database changes

- Migrations live in `supabase/migrations/`, applied in filename order.
  **Never edit a migration that's already been applied anywhere** — add a
  new numbered one instead, even to fix a bug in an earlier one. Say why
  in a comment. `CLAUDE.md`'s migration list and postmortems show the
  established pattern for this.
- If you're changing a `SECURITY DEFINER` function's parameter list,
  remember Postgres treats that as a new overload, not a replacement —
  you need `drop function ... ; create function ...`, and you must diff
  against the function's most recently patched body, not an older one
  (see postmortem #6 in `CLAUDE.md` for exactly how that goes wrong).
- After any grant/revoke change on a function, verify it directly —
  `select proacl from pg_proc where proname = '...'` — rather than
  trusting a `revoke ... from public` alone or an advisory tool's
  WARN-level output. See postmortems #1 and #3 for why.

## Commit messages

Short, descriptive summary line; use the body to explain *why* a change
was made if it's not obvious from the diff. Match the existing history's
style.
