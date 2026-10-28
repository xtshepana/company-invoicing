-- Monthly billing schedule.
--
-- 1. recurring_billing_day: one company-wide day of the month (1-28) on which every month-based recurring invoice is
--    created (e.g. 26). When it is set, the NEXT date worked out after an invoice is generated snaps to that day, so
--    every schedule drifts onto it and stays there - including a recurring invoice that was running on another day.
--    Weekly and custom-day schedules keep their own rhythm. NULL (the default) changes nothing.
-- 2. recurring_due_at_month_end: invoices generated from recurring invoices fall due on the last day of the month they
--    are issued, instead of N days later (the app applies this when it creates the invoice).
-- 3. payment_checkpoints_sent: new checkpoint names for the reminder calendar (last day of the month, the 5th, and the
--    list of unpaid accounts on the 7th). The old names stay allowed so existing history is untouched.

alter table public.company_settings
  add column recurring_billing_day smallint,
  add column recurring_due_at_month_end boolean not null default false;

alter table public.company_settings
  add constraint company_settings_recurring_billing_day_range
  check (recurring_billing_day is null or recurring_billing_day between 1 and 28);

do $$
declare
  v_constraint text;
begin
  select conname into v_constraint
  from pg_constraint
  where conrelid = 'public.payment_checkpoints_sent'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) like '%block_notice%';
  if v_constraint is not null then
    execute format('alter table public.payment_checkpoints_sent drop constraint %I', v_constraint);
  end if;
end;
$$;

alter table public.payment_checkpoints_sent
  add constraint payment_checkpoints_sent_checkpoint_check
  check (checkpoint in ('day_30', 'day_5', 'day_10', 'block_notice', 'reminder_1', 'reminder_2', 'block_list'));

-- Same signature, grants and behaviour as 0019_fix_recurring_invoice_numbering.sql; the only change is the billing-day
-- snap after the next date is computed. `create or replace` keeps the existing (service-role only) grants.
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
  v_billing_day smallint;
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

  -- Company billing day: month-based schedules land on that day of the month the next date falls in.
  select recurring_billing_day into v_billing_day from public.company_settings where id = true;
  if v_billing_day is not null and v_rec.frequency in ('monthly', 'every_2_months', 'quarterly', 'every_6_months', 'annually') then
    v_next_date := make_date(extract(year from v_next_date)::int, extract(month from v_next_date)::int, v_billing_day::int);
  end if;

  update public.recurring_invoices
  set next_invoice_date = v_next_date, last_generated_date = p_invoice_date
  where id = p_recurring_invoice_id;

  return v_invoice_id;
end;
$$;
