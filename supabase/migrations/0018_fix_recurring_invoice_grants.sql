-- Confirms and extends the 0013 lesson: Supabase's `public` schema has
-- default privileges that grant EXECUTE directly to `anon`/`authenticated`
-- (not via the PUBLIC pseudo-role) the moment a function is first
-- CREATEd. `revoke ... from public` never touches these — proven here by
-- querying pg_proc.proacl directly: every function 0017 created still
-- listed `anon=X` after its own `revoke ... from public` ran.
--
-- The only migrations that got this right on the first try (0003, 0012's
-- tail end) explicitly named `anon` in the revoke. From here on, always
-- revoke from anon (and authenticated, for service-role-only functions)
-- by name — never assume revoking from `public` was enough, and verify
-- with `select proacl from pg_proc where proname = '...'` rather than
-- trusting the advisor (which only flags anon/authenticated executability
-- as a WARN either way, so it won't catch a revoke that silently no-op'd).

revoke execute on function public.compute_next_recurring_date(date, public.recurring_frequency, integer) from anon;
revoke execute on function public.create_recurring_invoice(uuid, text, public.recurring_frequency, integer, date, date, integer, boolean, boolean, boolean, text, text, jsonb) from anon;
revoke execute on function public.update_recurring_invoice(uuid, uuid, text, public.recurring_frequency, integer, date, integer, boolean, boolean, boolean, text, text, jsonb) from anon;
revoke execute on function public.skip_next_recurring_invoice(uuid) from anon;

-- generate_recurring_invoice: service_role only. Revoke from both anon and
-- authenticated — an ordinary signed-in user must not be able to trigger
-- invoice generation directly, bypassing the cron's date/idempotency logic.
revoke execute on function public.generate_recurring_invoice(uuid, date, date, numeric, numeric, numeric, numeric, jsonb) from anon, authenticated;
