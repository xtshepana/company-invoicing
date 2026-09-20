-- Same fix as 0023, applied to the aging report: getAgingReport() fetched
-- every outstanding invoice unbounded and bucketed/summed them in JS.
-- Moves that into a single grouped SQL aggregate. `invoices.customer_id`
-- is `not null references customers(id) on delete restrict`, so an inner
-- join is safe — no invoice can exist without a matching customer.

create or replace function public.get_aging_report(p_as_of date)
returns table(
  customer_id uuid,
  customer_name text,
  bucket_current numeric,
  bucket_1_30 numeric,
  bucket_31_60 numeric,
  bucket_61_90 numeric,
  bucket_90_plus numeric,
  total numeric
)
language sql
stable
set search_path = public
as $$
  select
    i.customer_id,
    c.company_name as customer_name,
    coalesce(sum(i.balance_due) filter (where p_as_of - i.due_date <= 0), 0) as bucket_current,
    coalesce(sum(i.balance_due) filter (where p_as_of - i.due_date between 1 and 30), 0) as bucket_1_30,
    coalesce(sum(i.balance_due) filter (where p_as_of - i.due_date between 31 and 60), 0) as bucket_31_60,
    coalesce(sum(i.balance_due) filter (where p_as_of - i.due_date between 61 and 90), 0) as bucket_61_90,
    coalesce(sum(i.balance_due) filter (where p_as_of - i.due_date > 90), 0) as bucket_90_plus,
    coalesce(sum(i.balance_due), 0) as total
  from public.invoices i
  join public.customers c on c.id = i.customer_id
  where i.balance_due > 0
    and i.status not in ('cancelled', 'void')
  group by i.customer_id, c.company_name
  order by sum(i.balance_due) desc;
$$;

revoke execute on function public.get_aging_report(date) from public;
revoke execute on function public.get_aging_report(date) from anon;
grant execute on function public.get_aging_report(date) to authenticated;
