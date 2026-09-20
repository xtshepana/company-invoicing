## What & why

<!-- What does this change do, and why? Link an issue if there is one. -->

## Database changes

- [ ] No migration changes
- [ ] Added a new numbered migration in `supabase/migrations/` (never edited an existing one)
- [ ] Any new/changed `SECURITY DEFINER` function's grants were verified directly (`select proacl from pg_proc where proname = '...'`), not just assumed from `revoke ... from public`

## Verification

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `npm run build`
- [ ] Checked in the browser if this touches a page/component with a visible effect
- [ ] Added or updated a `tests/e2e/` spec if this is easy to cover end to end

## Notes for the reviewer

<!-- Anything non-obvious, a deliberate tradeoff, or a place you want a second look. -->
