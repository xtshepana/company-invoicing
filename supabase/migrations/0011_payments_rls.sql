-- RLS for payments/allocations/credits. Deliberately append-only: no
-- update/delete policy exists for any of these three tables, for anyone —
-- correcting a mistake means recording a new entry, never mutating
-- history (see architecture rule on financial data integrity).

alter table public.payments enable row level security;
alter table public.payment_allocations enable row level security;
alter table public.customer_credits enable row level security;

create policy payments_select on public.payments
  for select using (public.has_module_access('payments'));
create policy payments_insert on public.payments
  for insert with check (public.has_module_access('payments'));

create policy payment_allocations_select on public.payment_allocations
  for select using (public.has_module_access('payments'));
create policy payment_allocations_insert on public.payment_allocations
  for insert with check (public.has_module_access('payments'));

create policy customer_credits_select on public.customer_credits
  for select using (public.has_module_access('payments'));
create policy customer_credits_insert on public.customer_credits
  for insert with check (public.has_module_access('payments'));
