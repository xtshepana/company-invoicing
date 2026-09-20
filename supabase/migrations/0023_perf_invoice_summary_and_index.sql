-- Performance pass: the dashboard's invoice summary totals were being
-- computed by pulling every row in `invoices` into JS and reducing there
-- (server/services/invoices.ts getInvoiceSummaryTotals) — linearly slower
-- as the table grows, and pure overhead compared to letting Postgres do
-- the sum. This moves the aggregation into SQL. `balance_due` is also
-- filtered on (`balance_due > 0`) by five separate call sites — reports,
-- payments, bank-transactions candidate matching, invoice listing's
-- "overdue" filter, and the reminder cron — with no supporting index, so
-- each of those does a full scan today.

create index invoices_balance_due_idx on public.invoices (balance_due) where balance_due > 0;

-- Plain SQL function (not security definer) so it runs as the calling
-- role and is naturally governed by the existing invoices_select RLS
-- policy (has_module_access('invoices')) rather than needing its own
-- authorization check.
create or replace function public.get_invoice_summary_totals()
returns table(total_sales numeric, total_paid numeric, outstanding numeric, overdue numeric)
language sql
stable
set search_path = public
as $$
  select
    coalesce(sum(total) filter (where status not in ('cancelled', 'void')), 0) as total_sales,
    coalesce(sum(amount_paid), 0) as total_paid,
    coalesce(sum(balance_due) filter (where status not in ('cancelled', 'void')), 0) as outstanding,
    coalesce(
      sum(balance_due) filter (
        where status not in ('cancelled', 'void') and balance_due > 0 and due_date < current_date
      ),
      0
    ) as overdue
  from public.invoices;
$$;

revoke execute on function public.get_invoice_summary_totals() from public;
revoke execute on function public.get_invoice_summary_totals() from anon;
grant execute on function public.get_invoice_summary_totals() to authenticated;
