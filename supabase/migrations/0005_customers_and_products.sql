-- Phase 2: customers, products & services.

create type public.customer_type as enum ('business', 'individual');
create type public.product_type as enum ('product', 'service');

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  customer_type public.customer_type not null default 'business',
  company_name text not null,
  contact_person text not null default '',
  email text not null default '',
  phone text not null default '',
  mobile text not null default '',
  vat_number text not null default '',
  registration_number text not null default '',
  address_physical text not null default '',
  address_postal text not null default '',
  customer_reference text not null default '',
  -- null = use company_settings.default_payment_terms_days
  payment_terms_days integer check (payment_terms_days is null or payment_terms_days >= 0),
  -- Signed: positive means the customer owed us this amount when they were
  -- set up, before any invoice/payment existed in this system. Feeds
  -- customer statements once those are built (Phase 4).
  opening_balance numeric(14, 2) not null default 0,
  notes text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customers_company_name_idx on public.customers (company_name);
create index customers_is_active_idx on public.customers (is_active);
create index customers_email_idx on public.customers (email);

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create table public.products (
  id uuid primary key default gen_random_uuid(),
  type public.product_type not null default 'product',
  name text not null,
  sku text not null default '',
  description text not null default '',
  cost_price numeric(14, 2),
  selling_price numeric(14, 2) not null default 0 check (selling_price >= 0),
  -- Retained as this product's suggested rate only. Invoice/quote lines
  -- always copy the rate at the time they're created (see architecture
  -- rule in CLAUDE.md) — changing this later never rewrites past lines.
  vat_rate numeric(5, 2) not null check (vat_rate >= 0 and vat_rate <= 100),
  unit text not null default 'each',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index products_name_idx on public.products (name);
create index products_sku_idx on public.products (sku);
create index products_is_active_idx on public.products (is_active);

create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();
