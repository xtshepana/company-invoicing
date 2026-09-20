-- Phase 1: extensions, enums, updated_at trigger, profiles, company_settings, audit_logs.

create extension if not exists "pgcrypto";

create type public.user_role as enum ('owner_admin', 'accountant', 'staff');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per auth.users row. Role drives authorization everywhere else;
-- never trust a client-supplied role, always read this table server-side.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null default '',
  role public.user_role not null default 'staff',
  -- For role = 'staff' only: which modules they may access, e.g.
  -- {"customers": true, "invoices": true}. Ignored for owner_admin/accountant,
  -- who always have full access to their allowed module set.
  staff_module_permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Creates a profile row automatically whenever a new auth user is created.
-- The very first user in the system is bootstrapped as owner_admin since
-- there is no public registration/invite flow to assign that role otherwise.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  select not exists(select 1 from public.profiles) into is_first_user;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when is_first_user then 'owner_admin' else 'staff' end
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Singleton settings row (id is always true) — one company, one settings row.
create table public.company_settings (
  id boolean primary key default true constraint company_settings_singleton check (id),
  company_name text not null default 'Company Invoicing System',
  trading_name text not null default '',
  registration_number text not null default '',
  vat_number text not null default '',
  address_physical text not null default '',
  address_postal text not null default '',
  phone text not null default '',
  email text not null default '',
  website text not null default '',
  logo_url text,
  bank_name text not null default '',
  bank_account_name text not null default '',
  bank_account_number text not null default '',
  bank_branch_code text not null default '',
  bank_account_type text not null default '',
  invoice_prefix text not null default 'INV-',
  invoice_next_number integer not null default 1 check (invoice_next_number > 0),
  quote_prefix text not null default 'QUO-',
  quote_next_number integer not null default 1 check (quote_next_number > 0),
  credit_note_prefix text not null default 'CN-',
  credit_note_next_number integer not null default 1 check (credit_note_next_number > 0),
  default_payment_terms_days integer not null default 30 check (default_payment_terms_days >= 0),
  default_vat_rate numeric(5, 2) not null default 15.00 check (default_vat_rate >= 0 and default_vat_rate <= 100),
  default_prices_include_vat boolean not null default false,
  default_currency text not null default 'ZAR',
  default_invoice_notes text not null default '',
  default_invoice_footer text not null default '',
  default_quote_terms text not null default '',
  updated_at timestamptz not null default now()
);

insert into public.company_settings (id) values (true);

create trigger company_settings_set_updated_at
  before update on public.company_settings
  for each row execute function public.set_updated_at();

-- Append-only. Never updated or deleted by application code.
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity text not null,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on public.audit_logs (entity, entity_id);
create index audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index audit_logs_user_id_idx on public.audit_logs (user_id);
