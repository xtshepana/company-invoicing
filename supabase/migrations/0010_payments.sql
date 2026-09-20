-- Phase 4: payments, payment allocations, and a customer credit ledger.

create type public.payment_method as enum ('eft', 'cash', 'card', 'debit_order', 'instant_eft', 'other');
create type public.payment_allocation_status as enum ('unallocated', 'partially_allocated', 'fully_allocated');
create type public.credit_source as enum ('overpayment', 'applied_to_invoice', 'manual_adjustment', 'credit_note');

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  payment_date date not null default current_date,
  amount numeric(14, 2) not null check (amount > 0),
  payment_method public.payment_method not null default 'eft',
  bank_reference text not null default '',
  description text not null default '',
  -- 'manual' today; Phase 6/7's bank import will use 'bank_transaction' and
  -- link a bank_transactions row once that table exists.
  source text not null default 'manual',
  notes text not null default '',
  -- Describes how much of THIS payment is tied to invoices specifically —
  -- not "is this payment fully accounted for" (the remainder always becomes
  -- customer credit, so a manually recorded payment is always fully
  -- accounted for one way or another; genuine 'unallocated' rows only
  -- start appearing once bank-imported transactions exist).
  allocation_status public.payment_allocation_status not null default 'unallocated',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index payments_customer_id_idx on public.payments (customer_id);
create index payments_payment_date_idx on public.payments (payment_date desc);

-- Append-only by RLS design (see 0011) — a payment is never edited after
-- the fact; correcting a mistake means a new payment/credit entry, not a
-- mutation, so the ledger stays trustworthy.
create table public.payment_allocations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payments(id) on delete restrict,
  invoice_id uuid not null references public.invoices(id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index payment_allocations_payment_id_idx on public.payment_allocations (payment_id);
create index payment_allocations_invoice_id_idx on public.payment_allocations (invoice_id);

-- A signed ledger, not a single balance column — sum(amount) for a
-- customer is their current credit balance. Positive = credit added
-- (overpayment), negative = credit consumed (applied to an invoice).
create table public.customer_credits (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  amount numeric(14, 2) not null check (amount <> 0),
  source public.credit_source not null,
  payment_id uuid references public.payments(id) on delete set null,
  invoice_id uuid references public.invoices(id) on delete set null,
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index customer_credits_customer_id_idx on public.customer_credits (customer_id);
