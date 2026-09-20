-- Phase 5: recurring invoices + the plumbing the daily cron needs.

create type public.recurring_frequency as enum (
  'weekly', 'monthly', 'every_2_months', 'quarterly', 'every_6_months', 'annually', 'custom'
);
create type public.recurring_invoice_status as enum ('active', 'paused', 'cancelled');

create table public.recurring_invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  description text not null,
  frequency public.recurring_frequency not null default 'monthly',
  -- Only meaningful when frequency = 'custom'.
  custom_interval_days integer check (custom_interval_days is null or custom_interval_days > 0),
  start_date date not null default current_date,
  end_date date,
  next_invoice_date date not null,
  last_generated_date date,
  -- null = fall back to the customer's own override, then the company default.
  payment_terms_days integer check (payment_terms_days is null or payment_terms_days >= 0),
  prices_include_vat boolean not null default false,
  auto_generate boolean not null default true,
  auto_send_email boolean not null default false,
  status public.recurring_invoice_status not null default 'active',
  notes text not null default '',
  terms text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recurring_invoices_custom_interval_required
    check (frequency <> 'custom' or custom_interval_days is not null)
);

create index recurring_invoices_customer_id_idx on public.recurring_invoices (customer_id);
create index recurring_invoices_next_invoice_date_idx on public.recurring_invoices (next_invoice_date) where status = 'active';

create trigger recurring_invoices_set_updated_at
  before update on public.recurring_invoices
  for each row execute function public.set_updated_at();

create table public.recurring_invoice_items (
  id uuid primary key default gen_random_uuid(),
  recurring_invoice_id uuid not null references public.recurring_invoices(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  description text not null,
  quantity numeric(14, 4) not null check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  discount_percent numeric(5, 2) not null default 0 check (discount_percent >= 0 and discount_percent <= 100),
  vat_rate numeric(5, 2) not null check (vat_rate >= 0 and vat_rate <= 100),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index recurring_invoice_items_recurring_invoice_id_idx on public.recurring_invoice_items (recurring_invoice_id);

-- Links a generated invoice back to its template — this is also the
-- idempotency key the cron job checks before generating (see
-- generate_recurring_invoice below): if an invoice already exists for
-- (recurring_invoice_id, invoice_date), generation is skipped.
alter table public.invoices add column recurring_invoice_id uuid references public.recurring_invoices(id) on delete set null;
create index invoices_recurring_invoice_id_idx on public.invoices (recurring_invoice_id);

-- Transactional email audit trail (Phase 5).
create type public.email_status as enum ('sent', 'failed', 'skipped');

create table public.email_logs (
  id uuid primary key default gen_random_uuid(),
  email_type text not null,
  recipient text not null,
  subject text not null,
  entity text not null,
  entity_id text,
  status public.email_status not null,
  error text,
  created_at timestamptz not null default now()
);

create index email_logs_entity_idx on public.email_logs (entity, entity_id);
create index email_logs_created_at_idx on public.email_logs (created_at desc);

-- One row per (invoice, reminder offset) ever sent — prevents the daily
-- cron from emailing the same reminder twice if it runs more than once on
-- the same invoice/offset combination.
create table public.invoice_reminders_sent (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  offset_days integer not null,
  sent_at timestamptz not null default now(),
  unique (invoice_id, offset_days)
);

alter table public.company_settings add column payment_reminders_enabled boolean not null default true;
