create or replace function public.compute_next_recurring_date(
  p_current date,
  p_frequency public.recurring_frequency,
  p_custom_interval_days integer
)
returns date
language plpgsql
immutable
set search_path = public
as $$
begin
  return case p_frequency
    when 'weekly' then p_current + interval '7 days'
    when 'monthly' then p_current + interval '1 month'
    when 'every_2_months' then p_current + interval '2 months'
    when 'quarterly' then p_current + interval '3 months'
    when 'every_6_months' then p_current + interval '6 months'
    when 'annually' then p_current + interval '1 year'
    when 'custom' then p_current + make_interval(days => coalesce(p_custom_interval_days, 30))
  end::date;
end;
$$;

create or replace function public.create_recurring_invoice(
  p_customer_id uuid,
  p_description text,
  p_frequency public.recurring_frequency,
  p_custom_interval_days integer,
  p_start_date date,
  p_end_date date,
  p_payment_terms_days integer,
  p_prices_include_vat boolean,
  p_auto_generate boolean,
  p_auto_send_email boolean,
  p_notes text,
  p_terms text,
  p_line_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.has_module_access('recurring_invoices') then
    raise exception 'You do not have access to the recurring invoices module.';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'Add at least one line item.';
  end if;

  insert into public.recurring_invoices (
    customer_id, description, frequency, custom_interval_days, start_date, end_date, next_invoice_date,
    payment_terms_days, prices_include_vat, auto_generate, auto_send_email, notes, terms, created_by
  )
  values (
    p_customer_id, p_description, p_frequency, p_custom_interval_days, p_start_date, p_end_date, p_start_date,
    p_payment_terms_days, p_prices_include_vat, p_auto_generate, p_auto_send_email, p_notes, p_terms, auth.uid()
  )
  returning id into v_id;

  insert into public.recurring_invoice_items (
    recurring_invoice_id, product_id, description, quantity, unit_price, discount_percent, vat_rate, sort_order
  )
  select
    v_id,
    nullif(item ->> 'product_id', '')::uuid,
    item ->> 'description',
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price')::numeric,
    (item ->> 'discount_percent')::numeric,
    (item ->> 'vat_rate')::numeric,
    (item ->> 'sort_order')::int
  from jsonb_array_elements(p_line_items) as item;

  return v_id;
end;
$$;

create or replace function public.update_recurring_invoice(
  p_id uuid,
  p_customer_id uuid,
  p_description text,
  p_frequency public.recurring_frequency,
  p_custom_interval_days integer,
  p_end_date date,
  p_payment_terms_days integer,
  p_prices_include_vat boolean,
  p_auto_generate boolean,
  p_auto_send_email boolean,
  p_notes text,
  p_terms text,
  p_line_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_module_access('recurring_invoices') then
    raise exception 'You do not have access to the recurring invoices module.';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'Add at least one line item.';
  end if;

  update public.recurring_invoices set
    customer_id = p_customer_id,
    description = p_description,
    frequency = p_frequency,
    custom_interval_days = p_custom_interval_days,
    end_date = p_end_date,
    payment_terms_days = p_payment_terms_days,
    prices_include_vat = p_prices_include_vat,
    auto_generate = p_auto_generate,
    auto_send_email = p_auto_send_email,
    notes = p_notes,
    terms = p_terms
  where id = p_id;

  delete from public.recurring_invoice_items where recurring_invoice_id = p_id;

  insert into public.recurring_invoice_items (
    recurring_invoice_id, product_id, description, quantity, unit_price, discount_percent, vat_rate, sort_order
  )
  select
    p_id,
    nullif(item ->> 'product_id', '')::uuid,
    item ->> 'description',
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price')::numeric,
    (item ->> 'discount_percent')::numeric,
    (item ->> 'vat_rate')::numeric,
    (item ->> 'sort_order')::int
  from jsonb_array_elements(p_line_items) as item;
end;
$$;

create or replace function public.skip_next_recurring_invoice(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
begin
  if not public.has_module_access('recurring_invoices') then
    raise exception 'You do not have access to the recurring invoices module.';
  end if;

  select * into v_rec from public.recurring_invoices where id = p_id for update;
  if v_rec is null then
    raise exception 'Recurring invoice not found.';
  end if;

  update public.recurring_invoices
  set next_invoice_date = public.compute_next_recurring_date(v_rec.next_invoice_date, v_rec.frequency, v_rec.custom_interval_days)
  where id = p_id;
end;
$$;

-- Generates one invoice from a recurring template. Only ever called by the
-- cron route handler's service-role client — there is no auth.uid() in
-- that context, so this deliberately has no has_module_access() check
-- (unlike every other write RPC); its EXECUTE grant is restricted to
-- service_role only (see the revoke below) rather than authenticated, so
-- an ordinary signed-in user cannot call it directly regardless.
--
-- Idempotent by design: (recurring_invoice_id, invoice_date) is checked
-- before inserting, so running the cron twice for the same day is a no-op
-- the second time — it returns the already-generated invoice's id rather
-- than erroring or duplicating.
create or replace function public.generate_recurring_invoice(
  p_recurring_invoice_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_subtotal numeric,
  p_discount_total numeric,
  p_vat_total numeric,
  p_total numeric,
  p_line_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_existing_id uuid;
  v_invoice_id uuid;
  v_invoice_number text;
  v_next_date date;
begin
  select * into v_rec from public.recurring_invoices where id = p_recurring_invoice_id for update;
  if v_rec is null then
    raise exception 'Recurring invoice not found.';
  end if;

  select id into v_existing_id from public.invoices
  where recurring_invoice_id = p_recurring_invoice_id and invoice_date = p_invoice_date
  limit 1;
  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if v_rec.status <> 'active' or not v_rec.auto_generate then
    raise exception 'Recurring invoice is not active.';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'Recurring invoice has no line items.';
  end if;

  v_invoice_number := public.next_invoice_number();

  insert into public.invoices (
    invoice_number, customer_id, recurring_invoice_id, invoice_date, due_date,
    prices_include_vat, notes, terms, subtotal, discount_total, vat_total, total, created_by
  )
  values (
    v_invoice_number, v_rec.customer_id, p_recurring_invoice_id, p_invoice_date, p_due_date,
    v_rec.prices_include_vat, v_rec.notes, v_rec.terms, p_subtotal, p_discount_total, p_vat_total, p_total, v_rec.created_by
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, product_id, description, quantity, unit_price, discount_percent, vat_rate,
    line_subtotal, line_vat, line_total, sort_order
  )
  select
    v_invoice_id,
    nullif(item ->> 'product_id', '')::uuid,
    item ->> 'description',
    (item ->> 'quantity')::numeric,
    (item ->> 'unit_price')::numeric,
    (item ->> 'discount_percent')::numeric,
    (item ->> 'vat_rate')::numeric,
    (item ->> 'line_subtotal')::numeric,
    (item ->> 'line_vat')::numeric,
    (item ->> 'line_total')::numeric,
    (item ->> 'sort_order')::int
  from jsonb_array_elements(p_line_items) as item;

  v_next_date := public.compute_next_recurring_date(v_rec.next_invoice_date, v_rec.frequency, v_rec.custom_interval_days);

  update public.recurring_invoices
  set next_invoice_date = v_next_date, last_generated_date = p_invoice_date
  where id = p_recurring_invoice_id;

  return v_invoice_id;
end;
$$;

revoke execute on function public.create_recurring_invoice(uuid, text, public.recurring_frequency, integer, date, date, integer, boolean, boolean, boolean, text, text, jsonb) from public;
revoke execute on function public.update_recurring_invoice(uuid, uuid, text, public.recurring_frequency, integer, date, integer, boolean, boolean, boolean, text, text, jsonb) from public;
revoke execute on function public.skip_next_recurring_invoice(uuid) from public;
grant execute on function public.create_recurring_invoice(uuid, text, public.recurring_frequency, integer, date, date, integer, boolean, boolean, boolean, text, text, jsonb) to authenticated;
grant execute on function public.update_recurring_invoice(uuid, uuid, text, public.recurring_frequency, integer, date, integer, boolean, boolean, boolean, text, text, jsonb) to authenticated;
grant execute on function public.skip_next_recurring_invoice(uuid) to authenticated;

-- generate_recurring_invoice: service_role only (see comment on the
-- function above) — no grant to authenticated or anon at all. PUBLIC's
-- default grant must still be explicitly revoked, same lesson as 0013.
revoke execute on function public.generate_recurring_invoice(uuid, date, date, numeric, numeric, numeric, numeric, jsonb) from public;

revoke execute on function public.compute_next_recurring_date(date, public.recurring_frequency, integer) from public;
grant execute on function public.compute_next_recurring_date(date, public.recurring_frequency, integer) to authenticated;
