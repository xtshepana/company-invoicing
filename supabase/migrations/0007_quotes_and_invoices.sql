-- Phase 3: quotes, invoices, and concurrency-safe document numbering.

create type public.quote_status as enum ('draft', 'sent', 'accepted', 'rejected', 'expired', 'cancelled');
create type public.invoice_status as enum ('draft', 'sent', 'partially_paid', 'paid', 'cancelled', 'void');

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  quote_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  quote_date date not null default current_date,
  expiry_date date,
  reference text not null default '',
  status public.quote_status not null default 'draft',
  prices_include_vat boolean not null default false,
  subtotal numeric(14, 2) not null default 0,
  discount_total numeric(14, 2) not null default 0,
  vat_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  notes text not null default '',
  terms text not null default '',
  -- Set once this quote has been turned into an invoice (see
  -- convertQuoteToInvoiceAction) — a quote is never deleted or overwritten
  -- by the conversion, only linked and marked accepted.
  converted_invoice_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quotes_customer_id_idx on public.quotes (customer_id);
create index quotes_status_idx on public.quotes (status);
create index quotes_quote_date_idx on public.quotes (quote_date desc);

create trigger quotes_set_updated_at
  before update on public.quotes
  for each row execute function public.set_updated_at();

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
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

create index quote_items_quote_id_idx on public.quote_items (quote_id);

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  invoice_number text not null unique,
  customer_id uuid not null references public.customers(id) on delete restrict,
  quote_id uuid references public.quotes(id) on delete set null,
  invoice_date date not null default current_date,
  due_date date not null default current_date,
  reference text not null default '',
  status public.invoice_status not null default 'draft',
  prices_include_vat boolean not null default false,
  subtotal numeric(14, 2) not null default 0,
  discount_total numeric(14, 2) not null default 0,
  vat_total numeric(14, 2) not null default 0,
  total numeric(14, 2) not null default 0,
  -- Maintained by the payment allocation pipeline (Phase 4). Always 0 until
  -- then — never set directly from invoice create/edit code.
  amount_paid numeric(14, 2) not null default 0,
  balance_due numeric(14, 2) generated always as (total - amount_paid) stored,
  notes text not null default '',
  terms text not null default '',
  voided_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index invoices_customer_id_idx on public.invoices (customer_id);
create index invoices_status_idx on public.invoices (status);
create index invoices_invoice_date_idx on public.invoices (invoice_date desc);
create index invoices_due_date_idx on public.invoices (due_date);

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

alter table public.quotes
  add constraint quotes_converted_invoice_id_fkey
  foreign key (converted_invoice_id) references public.invoices(id) on delete set null;

create table public.invoice_items (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
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

create index invoice_items_invoice_id_idx on public.invoice_items (invoice_id);

-- Concurrency-safe numbering: the UPDATE takes a row lock on the single
-- company_settings row, so concurrent callers serialize and each gets a
-- distinct, gap-free-in-practice number. SECURITY DEFINER because bumping
-- the counter must work for accountants/staff who don't have UPDATE rights
-- on company_settings; has_module_access() re-checks authorization inside
-- the function as defense in depth (see architecture rule 6).
create or replace function public.next_quote_number()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  result text;
begin
  if not public.has_module_access('quotes') then
    raise exception 'You do not have access to the quotes module.';
  end if;

  update public.company_settings
  set quote_next_number = quote_next_number + 1
  where id = true
  returning quote_prefix || lpad((quote_next_number - 1)::text, 6, '0') into result;

  return result;
end;
$$;

create or replace function public.next_invoice_number()
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
  set invoice_next_number = invoice_next_number + 1
  where id = true
  returning invoice_prefix || lpad((invoice_next_number - 1)::text, 6, '0') into result;

  return result;
end;
$$;

revoke execute on function public.next_quote_number() from anon;
revoke execute on function public.next_invoice_number() from anon;
