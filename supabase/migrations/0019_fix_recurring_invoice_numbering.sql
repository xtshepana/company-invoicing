-- generate_recurring_invoice() is deliberately callable with no auth.uid()
-- (see the comment on it in 0017_recurring_invoice_functions.sql — it's
-- service_role-only, invoked from the cron route). It called
-- next_invoice_number() to get the next invoice number, but that function
-- starts with `if not has_module_access('invoices') then raise exception`,
-- and has_module_access() looks up auth.uid() in `profiles` — which is
-- null in a service-role/cron context, so the check always failed with
-- "You do not have access to the invoices module." This was only caught by
-- actually running the cron endpoint against a real due recurring invoice,
-- not by anything that runs before deploy: every type/lint/build/test
-- passed because the bug is a runtime authorization check, not a type.
--
-- Fixed by inlining next_invoice_number()'s row-locked
-- UPDATE ... RETURNING directly into generate_recurring_invoice(), so it no
-- longer depends on any auth-gated helper. next_invoice_number() itself is
-- untouched and still has_module_access-gated for its normal callers
-- (create_invoice, called by a signed-in user).
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

  update public.company_settings
  set invoice_next_number = invoice_next_number + 1
  where id = true
  returning invoice_prefix || lpad((invoice_next_number - 1)::text, 6, '0') into v_invoice_number;

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

revoke execute on function public.generate_recurring_invoice(uuid, date, date, numeric, numeric, numeric, numeric, jsonb) from public;
revoke execute on function public.generate_recurring_invoice(uuid, date, date, numeric, numeric, numeric, numeric, jsonb) from anon;
revoke execute on function public.generate_recurring_invoice(uuid, date, date, numeric, numeric, numeric, numeric, jsonb) from authenticated;
