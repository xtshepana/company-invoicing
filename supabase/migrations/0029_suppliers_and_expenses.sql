-- Suppliers & expense tracking. Lean MVP per explicit scoping: supplier
-- profiles (mirrors customers/products) + a simple expense log (no VAT
-- breakdown, no attachments, no dedicated report page - those can follow
-- later if needed). Gated behind its own "suppliers" staff module,
-- consistent with every other section of the app.

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  contact_person text not null default '',
  email text not null default '',
  phone text not null default '',
  vat_number text not null default '',
  address_physical text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index suppliers_company_name_idx on public.suppliers (company_name);
create index suppliers_is_active_idx on public.suppliers (is_active);

create trigger suppliers_set_updated_at
  before update on public.suppliers
  for each row execute function public.set_updated_at();

-- Unlike every other document table in this app, expenses are internal
-- spend records with no external distribution (never sent to anyone the
-- way an invoice or quote is) and no downstream ledger effect - so unlike
-- customers/invoices/etc. (always archived, never hard-deleted), a real
-- delete is allowed here rather than adding an archive/reactivate flow
-- this MVP doesn't need.
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid references public.suppliers(id) on delete set null,
  expense_date date not null default current_date,
  description text not null default '',
  category text not null default '',
  amount numeric(14, 2) not null check (amount >= 0),
  notes text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index expenses_expense_date_idx on public.expenses (expense_date);
create index expenses_supplier_id_idx on public.expenses (supplier_id);

create trigger expenses_set_updated_at
  before update on public.expenses
  for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;
alter table public.expenses enable row level security;

create policy suppliers_select on public.suppliers
  for select
  using (public.has_module_access('suppliers'));

create policy suppliers_insert on public.suppliers
  for insert
  with check (public.has_module_access('suppliers'));

create policy suppliers_update on public.suppliers
  for update
  using (public.has_module_access('suppliers'))
  with check (public.has_module_access('suppliers'));

create policy expenses_select on public.expenses
  for select
  using (public.has_module_access('suppliers'));

create policy expenses_insert on public.expenses
  for insert
  with check (public.has_module_access('suppliers'));

create policy expenses_update on public.expenses
  for update
  using (public.has_module_access('suppliers'))
  with check (public.has_module_access('suppliers'));

create policy expenses_delete on public.expenses
  for delete
  using (public.has_module_access('suppliers'));
