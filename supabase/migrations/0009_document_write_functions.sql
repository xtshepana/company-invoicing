-- Quotes/invoices are always written header+lines together, atomically —
-- a plpgsql function body runs as a single transaction, so a line-item
-- insert failure rolls back the header insert too (unlike separate client
-- calls, which could leave an orphaned header row behind).

create or replace function public.create_quote(
  p_customer_id uuid,
  p_quote_date date,
  p_expiry_date date,
  p_reference text,
  p_prices_include_vat boolean,
  p_notes text,
  p_terms text,
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
  v_quote_id uuid;
  v_quote_number text;
begin
  if not public.has_module_access('quotes') then
    raise exception 'You do not have access to the quotes module.';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'Add at least one line item.';
  end if;

  v_quote_number := public.next_quote_number();

  insert into public.quotes (
    quote_number, customer_id, quote_date, expiry_date, reference,
    prices_include_vat, notes, terms, subtotal, discount_total, vat_total, total, created_by
  )
  values (
    v_quote_number, p_customer_id, p_quote_date, p_expiry_date, p_reference,
    p_prices_include_vat, p_notes, p_terms, p_subtotal, p_discount_total, p_vat_total, p_total, auth.uid()
  )
  returning id into v_quote_id;

  insert into public.quote_items (
    quote_id, product_id, description, quantity, unit_price, discount_percent, vat_rate,
    line_subtotal, line_vat, line_total, sort_order
  )
  select
    v_quote_id,
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

  return v_quote_id;
end;
$$;

create or replace function public.update_quote(
  p_quote_id uuid,
  p_customer_id uuid,
  p_quote_date date,
  p_expiry_date date,
  p_reference text,
  p_prices_include_vat boolean,
  p_notes text,
  p_terms text,
  p_subtotal numeric,
  p_discount_total numeric,
  p_vat_total numeric,
  p_total numeric,
  p_line_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_converted uuid;
begin
  if not public.has_module_access('quotes') then
    raise exception 'You do not have access to the quotes module.';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'Add at least one line item.';
  end if;

  select converted_invoice_id into v_converted from public.quotes where id = p_quote_id;
  if v_converted is not null then
    raise exception 'This quote has already been converted to an invoice and can no longer be edited.';
  end if;

  update public.quotes set
    customer_id = p_customer_id,
    quote_date = p_quote_date,
    expiry_date = p_expiry_date,
    reference = p_reference,
    prices_include_vat = p_prices_include_vat,
    notes = p_notes,
    terms = p_terms,
    subtotal = p_subtotal,
    discount_total = p_discount_total,
    vat_total = p_vat_total,
    total = p_total
  where id = p_quote_id;

  delete from public.quote_items where quote_id = p_quote_id;

  insert into public.quote_items (
    quote_id, product_id, description, quantity, unit_price, discount_percent, vat_rate,
    line_subtotal, line_vat, line_total, sort_order
  )
  select
    p_quote_id,
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
end;
$$;

create or replace function public.create_invoice(
  p_customer_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_reference text,
  p_prices_include_vat boolean,
  p_notes text,
  p_terms text,
  p_subtotal numeric,
  p_discount_total numeric,
  p_vat_total numeric,
  p_total numeric,
  p_line_items jsonb,
  p_quote_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_id uuid;
  v_invoice_number text;
begin
  if not public.has_module_access('invoices') then
    raise exception 'You do not have access to the invoices module.';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'Add at least one line item.';
  end if;

  v_invoice_number := public.next_invoice_number();

  insert into public.invoices (
    invoice_number, customer_id, quote_id, invoice_date, due_date, reference,
    prices_include_vat, notes, terms, subtotal, discount_total, vat_total, total, created_by
  )
  values (
    v_invoice_number, p_customer_id, p_quote_id, p_invoice_date, p_due_date, p_reference,
    p_prices_include_vat, p_notes, p_terms, p_subtotal, p_discount_total, p_vat_total, p_total, auth.uid()
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

  return v_invoice_id;
end;
$$;

create or replace function public.update_invoice(
  p_invoice_id uuid,
  p_customer_id uuid,
  p_invoice_date date,
  p_due_date date,
  p_reference text,
  p_prices_include_vat boolean,
  p_notes text,
  p_terms text,
  p_subtotal numeric,
  p_discount_total numeric,
  p_vat_total numeric,
  p_total numeric,
  p_line_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.invoice_status;
  v_amount_paid numeric;
begin
  if not public.has_module_access('invoices') then
    raise exception 'You do not have access to the invoices module.';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'Add at least one line item.';
  end if;

  select status, amount_paid into v_status, v_amount_paid from public.invoices where id = p_invoice_id;
  if v_status in ('paid', 'void', 'cancelled') or v_amount_paid > 0 then
    raise exception 'This invoice has payments or is finalized and can no longer be edited. Use a credit note instead.';
  end if;

  update public.invoices set
    customer_id = p_customer_id,
    invoice_date = p_invoice_date,
    due_date = p_due_date,
    reference = p_reference,
    prices_include_vat = p_prices_include_vat,
    notes = p_notes,
    terms = p_terms,
    subtotal = p_subtotal,
    discount_total = p_discount_total,
    vat_total = p_vat_total,
    total = p_total
  where id = p_invoice_id;

  delete from public.invoice_items where invoice_id = p_invoice_id;

  insert into public.invoice_items (
    invoice_id, product_id, description, quantity, unit_price, discount_percent, vat_rate,
    line_subtotal, line_vat, line_total, sort_order
  )
  select
    p_invoice_id,
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
end;
$$;

-- Converts an accepted quote into a new invoice, copying line items
-- exactly. The quote itself is never modified except to link it to the
-- resulting invoice and mark it accepted (see architecture note in
-- 0007_quotes_and_invoices.sql).
create or replace function public.convert_quote_to_invoice(p_quote_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quote record;
  v_invoice_id uuid;
  v_invoice_number text;
  v_terms_days integer;
  v_due_date date;
begin
  if not public.has_module_access('quotes') then
    raise exception 'You do not have access to the quotes module.';
  end if;
  if not public.has_module_access('invoices') then
    raise exception 'You do not have access to the invoices module.';
  end if;

  select * into v_quote from public.quotes where id = p_quote_id;
  if v_quote is null then
    raise exception 'Quote not found.';
  end if;
  if v_quote.converted_invoice_id is not null then
    raise exception 'This quote has already been converted to an invoice.';
  end if;

  select coalesce(c.payment_terms_days, cs.default_payment_terms_days)
  into v_terms_days
  from public.customers c, public.company_settings cs
  where c.id = v_quote.customer_id and cs.id = true;

  v_due_date := current_date + make_interval(days => coalesce(v_terms_days, 30));
  v_invoice_number := public.next_invoice_number();

  insert into public.invoices (
    invoice_number, customer_id, quote_id, invoice_date, due_date, reference,
    prices_include_vat, notes, terms, subtotal, discount_total, vat_total, total, created_by
  )
  values (
    v_invoice_number, v_quote.customer_id, v_quote.id, current_date, v_due_date, v_quote.reference,
    v_quote.prices_include_vat, v_quote.notes, v_quote.terms,
    v_quote.subtotal, v_quote.discount_total, v_quote.vat_total, v_quote.total, auth.uid()
  )
  returning id into v_invoice_id;

  insert into public.invoice_items (
    invoice_id, product_id, description, quantity, unit_price, discount_percent, vat_rate,
    line_subtotal, line_vat, line_total, sort_order
  )
  select
    v_invoice_id, product_id, description, quantity, unit_price, discount_percent, vat_rate,
    line_subtotal, line_vat, line_total, sort_order
  from public.quote_items
  where quote_id = p_quote_id;

  update public.quotes set converted_invoice_id = v_invoice_id, status = 'accepted' where id = p_quote_id;

  return v_invoice_id;
end;
$$;

revoke execute on function public.create_quote(uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from anon;
revoke execute on function public.update_quote(uuid, uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from anon;
revoke execute on function public.create_invoice(uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb, uuid) from anon;
revoke execute on function public.update_invoice(uuid, uuid, date, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from anon;
revoke execute on function public.convert_quote_to_invoice(uuid) from anon;
