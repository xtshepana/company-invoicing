-- Fixed calendar-date payment reminder checkpoints (the 30th, 5th, and
-- 10th of each month) replacing the old due-date-relative offset schedule
-- (invoice_reminders_sent, left in place as historical data but no longer
-- written to). period_month lets the same checkpoint fire again in a later
-- month for an invoice that stays unpaid across multiple billing cycles -
-- unlike the old table, a given (invoice, checkpoint) pair is expected to
-- repeat over time here, just not twice in the same month.
create table public.payment_checkpoints_sent (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  checkpoint text not null check (checkpoint in ('day_30', 'day_5', 'day_10', 'block_notice')),
  period_month date not null,
  sent_at timestamptz not null default now(),
  unique (invoice_id, checkpoint, period_month)
);

alter table public.payment_checkpoints_sent enable row level security;

-- Written only by the cron job's service-role client — nothing for
-- authenticated users to do with this table directly (same pattern as
-- invoice_reminders_sent in 0016_recurring_invoices_rls.sql).
create policy payment_checkpoints_sent_admin_select on public.payment_checkpoints_sent
  for select using (public.is_admin());

-- Where the internal "no payment detected, review for suspension" notice
-- goes after the final (10th) checkpoint. Nullable - the notice is simply
-- skipped (logged, not an error) if this isn't configured yet.
alter table public.company_settings add column accounts_notification_email text;
