-- Fixes a real gap from migrations 0007/0009/0012: `revoke ... from anon`
-- does not remove the EXECUTE grant Postgres gives to PUBLIC by default on
-- function creation, and every role (including anon) implicitly inherits
-- PUBLIC's privileges. `has_function_privilege('anon', 'record_payment(...)',
-- 'execute')` returned true despite the earlier revoke, proving this.
--
-- None of these were actually exploitable — every one of them re-checks
-- has_module_access()/is_admin() against auth.uid() internally and raises
-- before doing anything for an unauthenticated caller — but PUBLIC
-- execute access on financial-mutation RPCs is the wrong default to leave
-- in place. Revoke from PUBLIC and grant back explicitly to authenticated
-- only.

revoke execute on function public.is_admin() from public;
revoke execute on function public.is_active_staff() from public;
revoke execute on function public.current_role_name() from public;
revoke execute on function public.has_module_access(text) from public;
revoke execute on function public.next_quote_number() from public;
revoke execute on function public.next_invoice_number() from public;
revoke execute on function public.create_quote(uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from public;
revoke execute on function public.update_quote(uuid, uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from public;
revoke execute on function public.create_invoice(uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb, uuid) from public;
revoke execute on function public.update_invoice(uuid, uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from public;
revoke execute on function public.convert_quote_to_invoice(uuid) from public;
revoke execute on function public.record_payment(uuid, date, numeric, public.payment_method, text, text, text, jsonb) from public;
revoke execute on function public.apply_customer_credit(uuid, uuid, numeric, text) from public;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.current_role_name() to authenticated;
grant execute on function public.has_module_access(text) to authenticated;
grant execute on function public.next_quote_number() to authenticated;
grant execute on function public.next_invoice_number() to authenticated;
grant execute on function public.create_quote(uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) to authenticated;
grant execute on function public.update_quote(uuid, uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) to authenticated;
grant execute on function public.create_invoice(uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb, uuid) to authenticated;
grant execute on function public.update_invoice(uuid, uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) to authenticated;
grant execute on function public.convert_quote_to_invoice(uuid) to authenticated;
grant execute on function public.record_payment(uuid, date, numeric, public.payment_method, text, text, text, jsonb) to authenticated;
grant execute on function public.apply_customer_credit(uuid, uuid, numeric, text) to authenticated;
