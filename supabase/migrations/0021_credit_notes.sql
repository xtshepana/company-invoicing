-- Phase 7: credit notes. A credit note is a real, numbered, PDF-able
-- document (line items, VAT breakdown, an optional reference invoice, a
-- reason) that — once issued — feeds the customer_credits ledger already
-- built in Phase 4 with a `'credit_note'` source (that enum value has sat
-- unused in credit_source since 0010_payments.sql). Deliberately does NOT
-- add a new "apply this credit note to an invoice" mechanism: issuing a
-- credit note just adds to the customer's pooled credit balance, and
-- applying it to any invoice reuses apply_customer_credit() exactly as
-- it already works for overpayments. This keeps credit fungible (as the
-- ledger already treats it) instead of trying to trace one specific
-- credit note's money through to one specific invoice.

create type public.credit_note_status as enum ('draft', 'issued', 'cancelled');

create table public.credit_notes (
  id uuid primary key default gen_random_uuid(),
  credit_note_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  invoice_id uuid references public.invoices(id) on delete set null,
  credit_note_date date not null default current_date,
  reason text not null default '',
  status public.credit_note_status not null default 'draft',
  prices_include_vat boolean not null default false,
  subtotal numeric(14, 2) not null default 0,
  discount_total numeric(14, 2) not null default 0,
  vat_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  notes text not null default '',
  terms text not null default '',
  issued_at timestamptz,
  voided_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index credit_notes_customer_id_idx on public.credit_notes (customer_id);
create index credit_notes_status_idx on public.credit_notes (status);
create index credit_notes_credit_note_date_idx on public.credit_notes (credit_note_date desc);

create trigger credit_notes_set_updated_at
  before update on public.credit_notes
  for each row execute function public.set_updated_at();

create table public.credit_note_items (
  id uuid primary key default gen_random_uuid(),
  credit_note_id uuid not null references public.credit_notes(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(14, 4) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  vat_rate numeric(5, 2) not null check (vat_rate >= 0 and vat_rate <= 100),
  line_subtotal numeric(14, 2) not null,
  line_vat numeric(14, 2) not null,
  line_total numeric(14, 2) not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index credit_note_items_credit_note_id_idx on public.credit_note_items (credit_note_id);

alter table public.customer_credits add column credit_note_id uuid references public.credit_notes(id) on delete set null;

alter table public.credit_notes enable row level security;
alter table public.credit_note_items enable row level security;

-- Credit notes live under the existing "invoices" module — there is no
-- separate staff permission for them, matching how there's no separate
-- one for quote-to-invoice conversion either.
create policy credit_notes_select on public.credit_notes
  for select using (public.has_module_access('invoices'));
create policy credit_notes_insert on public.credit_notes
  for insert with check (public.has_module_access('invoices'));
create policy credit_notes_update on public.credit_notes
  for update using (public.has_module_access('invoices')) with check (public.has_module_access('invoices'));

create policy credit_note_items_select on public.credit_note_items
  for select using (public.has_module_access('invoices'));
create policy credit_note_items_insert on public.credit_note_items
  for insert with check (public.has_module_access('invoices'));
create policy credit_note_items_update on public.credit_note_items
  for update using (public.has_module_access('invoices')) with check (public.has_module_access('invoices'));
create policy credit_note_items_delete on public.credit_note_items
  for delete using (public.has_module_access('invoices'));

create or replace function public.next_credit_note_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result text;
begin
  if not public.has_module_access('invoices') then
    raise exception 'You do not have access to the invoices module.';
  end if;

  update public.company_settings
  set credit_note_next_number = credit_note_next_number + 1
  where id = true
  returning credit_note_prefix || lpad((credit_note_next_number - 1)::text, 6, '0') into result;

  return result;
end;
$$;

create or replace function public.create_credit_note(
  p_customer_id uuid,
  p_invoice_id uuid,
  p_credit_note_date date,
  p_reason text,
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
  v_credit_note_id uuid;
  v_credit_note_number text;
begin
  if not public.has_module_access('invoices') then
    raise exception 'You do not have access to the invoices module.';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'Add at least one line item.';
  end if;
  if p_invoice_id is not null and not exists (
    select 1 from public.invoices where id = p_invoice_id and customer_id = p_customer_id
  ) then
    raise exception 'That invoice does not belong to this customer.';
  end if;

  v_credit_note_number := public.next_credit_note_number();

  insert into public.credit_notes (
    credit_note_number, customer_id, invoice_id, credit_note_date, reason,
    prices_include_vat, notes, terms, subtotal, discount_total, vat_total, total, created_by
  )
  values (
    v_credit_note_number, p_customer_id, p_invoice_id, p_credit_note_date, p_reason,
    p_prices_include_vat, p_notes, p_terms, p_subtotal, p_discount_total, p_vat_total, p_total, auth.uid()
  )
  returning id into v_credit_note_id;

  insert into public.credit_note_items (
    credit_note_id, product_id, description, quantity, unit_price, discount_percent, vat_rate,
    line_subtotal, line_vat, line_total, sort_order
  )
  select
    v_credit_note_id,
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

  return v_credit_note_id;
end;
$$;

create or replace function public.update_credit_note(
  p_credit_note_id uuid,
  p_customer_id uuid,
  p_invoice_id uuid,
  p_credit_note_date date,
  p_reason text,
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
  v_status public.credit_note_status;
begin
  if not public.has_module_access('invoices') then
    raise exception 'You do not have access to the invoices module.';
  end if;
  if jsonb_array_length(p_line_items) = 0 then
    raise exception 'Add at least one line item.';
  end if;

  select status into v_status from public.credit_notes where id = p_credit_note_id for update;
  if v_status is null then
    raise exception 'Credit note not found.';
  end if;
  if v_status <> 'draft' then
    raise exception 'This credit note has already been issued and can no longer be edited.';
  end if;
  if p_invoice_id is not null and not exists (
    select 1 from public.invoices where id = p_invoice_id and customer_id = p_customer_id
  ) then
    raise exception 'That invoice does not belong to this customer.';
  end if;

  update public.credit_notes set
    customer_id = p_customer_id,
    invoice_id = p_invoice_id,
    credit_note_date = p_credit_note_date,
    reason = p_reason,
    prices_include_vat = p_prices_include_vat,
    notes = p_notes,
    terms = p_terms,
    subtotal = p_subtotal,
    discount_total = p_discount_total,
    vat_total = p_vat_total,
    total = p_total
  where id = p_credit_note_id;

  delete from public.credit_note_items where credit_note_id = p_credit_note_id;

  insert into public.credit_note_items (
    credit_note_id, product_id, description, quantity, unit_price, discount_percent, vat_rate,
    line_subtotal, line_vat, line_total, sort_order
  )
  select
    p_credit_note_id,
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

-- Issuing is the one moment a credit note actually changes the customer's
-- available credit — before this it's just a draft document with no
-- ledger effect at all.
create or replace function public.issue_credit_note(p_credit_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
begin
  if not public.has_module_access('invoices') then
    raise exception 'You do not have access to the invoices module.';
  end if;

  select * into v_rec from public.credit_notes where id = p_credit_note_id for update;
  if v_rec is null then
    raise exception 'Credit note not found.';
  end if;
  if v_rec.status <> 'draft' then
    raise exception 'This credit note has already been issued or cancelled.';
  end if;
  if v_rec.total <= 0 then
    raise exception 'Add at least one line item before issuing.';
  end if;

  update public.credit_notes set status = 'issued', issued_at = now() where id = p_credit_note_id;

  insert into public.customer_credits (customer_id, amount, source, invoice_id, credit_note_id, notes)
  values (
    v_rec.customer_id, v_rec.total, 'credit_note', v_rec.invoice_id, p_credit_note_id,
    'Credit note ' || v_rec.credit_note_number || coalesce(' — ' || nullif(v_rec.reason, ''), '')
  );
end;
$$;

-- Draft: no ledger effect yet, so cancelling is a plain status flip.
-- Issued: only reversible if the credit hasn't been spent — this is a
-- pooled/fungible ledger (like the rest of Phase 4), so "hasn't been
-- spent" is checked as "the customer's current balance still covers this
-- credit note's amount", not by tracing this specific credit through to a
-- specific invoice.
create or replace function public.void_credit_note(p_credit_note_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rec record;
  v_current_balance numeric;
begin
  if not public.has_module_access('invoices') then
    raise exception 'You do not have access to the invoices module.';
  end if;

  select * into v_rec from public.credit_notes where id = p_credit_note_id for update;
  if v_rec is null then
    raise exception 'Credit note not found.';
  end if;
  if v_rec.status = 'cancelled' then
    raise exception 'This credit note has already been cancelled.';
  end if;

  if v_rec.status = 'issued' then
    select coalesce(sum(amount), 0) into v_current_balance
    from public.customer_credits
    where customer_id = v_rec.customer_id;

    if v_current_balance < v_rec.total then
      raise exception 'This credit has already been partially or fully applied and cannot be cancelled.';
    end if;

    insert into public.customer_credits (customer_id, amount, source, credit_note_id, notes)
    values (v_rec.customer_id, -v_rec.total, 'manual_adjustment', p_credit_note_id, 'Reversed: credit note ' || v_rec.credit_note_number || ' cancelled');
  end if;

  update public.credit_notes set status = 'cancelled', voided_at = now() where id = p_credit_note_id;
end;
$$;

revoke execute on function public.next_credit_note_number() from public;
revoke execute on function public.next_credit_note_number() from anon;
grant execute on function public.next_credit_note_number() to authenticated;

revoke execute on function public.create_credit_note(uuid, uuid, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from public;
revoke execute on function public.create_credit_note(uuid, uuid, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from anon;
grant execute on function public.create_credit_note(uuid, uuid, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) to authenticated;

revoke execute on function public.update_credit_note(uuid, uuid, uuid, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from public;
revoke execute on function public.update_credit_note(uuid, uuid, uuid, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) from anon;
grant execute on function public.update_credit_note(uuid, uuid, uuid, date, text, boolean, text, text, numeric, numeric, numeric, numeric, jsonb) to authenticated;

revoke execute on function public.issue_credit_note(uuid) from public;
revoke execute on function public.issue_credit_note(uuid) from anon;
grant execute on function public.issue_credit_note(uuid) to authenticated;

revoke execute on function public.void_credit_note(uuid) from public;
revoke execute on function public.void_credit_note(uuid) from anon;
grant execute on function public.void_credit_note(uuid) to authenticated;
