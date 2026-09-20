-- RLS for customers/products. Same defense-in-depth caveat as 0002_rls.sql
-- applies — server actions independently call requireModuleAccess() too.

create or replace function public.has_module_access(module text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid()
      and is_active
      and (
        role in ('owner_admin', 'accountant')
        or (role = 'staff' and coalesce((staff_module_permissions ->> module)::boolean, false))
      )
  );
$$;

revoke execute on function public.has_module_access(text) from anon;

alter table public.customers enable row level security;
alter table public.products enable row level security;

create policy customers_select on public.customers
  for select
  using (public.has_module_access('customers'));

create policy customers_insert on public.customers
  for insert
  with check (public.has_module_access('customers'));

create policy customers_update on public.customers
  for update
  using (public.has_module_access('customers'))
  with check (public.has_module_access('customers'));

create policy products_select on public.products
  for select
  using (public.has_module_access('products'));

create policy products_insert on public.products
  for insert
  with check (public.has_module_access('products'));

create policy products_update on public.products
  for update
  using (public.has_module_access('products'))
  with check (public.has_module_access('products'));
