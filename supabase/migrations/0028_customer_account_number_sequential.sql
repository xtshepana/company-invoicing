-- Customer "account number" (formerly free-text/random "customer reference")
-- is now a system-generated, sequential value: 3 letters from the company
-- name + a 3-digit number starting at 001, e.g. "ABC001". Concurrency-safe
-- via the same "update ... returning" row-lock pattern next_invoice_number()
-- already uses (0007_quotes_and_invoices.sql) - the UPDATE takes a row lock
-- on company_settings, so concurrent callers are serialized, not racing.

alter table company_settings
  add column customer_next_number integer not null default 1;

create or replace function public.next_customer_account_number(p_company_name text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_number int;
begin
  if not public.has_module_access('customers') then
    raise exception 'You do not have access to the customers module.';
  end if;

  v_prefix := rpad(left(upper(regexp_replace(coalesce(p_company_name, ''), '[^A-Za-z]', '', 'g')), 3), 3, 'X');

  update public.company_settings
  set customer_next_number = customer_next_number + 1
  where id = true
  returning customer_next_number - 1 into v_number;

  return v_prefix || lpad(v_number::text, 3, '0');
end;
$$;

revoke execute on function public.next_customer_account_number(text) from anon;

-- Backfill existing customers (in the order they were created) so every
-- customer already has a value in the new format before this ships, rather
-- than waiting for each one to be individually edited. Inlines the same
-- logic as next_customer_account_number() rather than calling it directly -
-- that function checks has_module_access(), which reads auth.uid(), which
-- is null in a migration's session (same reasoning as
-- 0019_fix_recurring_invoice_numbering.sql).
do $$
declare
  r record;
  v_prefix text;
  v_number int;
begin
  for r in select id, company_name from customers order by created_at loop
    v_prefix := rpad(left(upper(regexp_replace(coalesce(r.company_name, ''), '[^A-Za-z]', '', 'g')), 3), 3, 'X');

    update company_settings
    set customer_next_number = customer_next_number + 1
    where id = true
    returning customer_next_number - 1 into v_number;

    update customers
    set customer_reference = v_prefix || lpad(v_number::text, 3, '0')
    where id = r.id;
  end loop;
end;
$$;
