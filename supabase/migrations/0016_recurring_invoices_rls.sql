alter table public.recurring_invoices enable row level security;
alter table public.recurring_invoice_items enable row level security;
alter table public.email_logs enable row level security;
alter table public.invoice_reminders_sent enable row level security;

create policy recurring_invoices_select on public.recurring_invoices
  for select using (public.has_module_access('recurring_invoices'));
create policy recurring_invoices_insert on public.recurring_invoices
  for insert with check (public.has_module_access('recurring_invoices'));
create policy recurring_invoices_update on public.recurring_invoices
  for update using (public.has_module_access('recurring_invoices')) with check (public.has_module_access('recurring_invoices'));

create policy recurring_invoice_items_select on public.recurring_invoice_items
  for select using (public.has_module_access('recurring_invoices'));
create policy recurring_invoice_items_insert on public.recurring_invoice_items
  for insert with check (public.has_module_access('recurring_invoices'));
create policy recurring_invoice_items_update on public.recurring_invoice_items
  for update using (public.has_module_access('recurring_invoices')) with check (public.has_module_access('recurring_invoices'));
create policy recurring_invoice_items_delete on public.recurring_invoice_items
  for delete using (public.has_module_access('recurring_invoices'));

-- Email logs may contain customer email addresses — admin-only, and
-- append-only (written by the service-role client from server code, same
-- pattern as audit_logs; no insert/update/delete policy for anyone else).
create policy email_logs_admin_select on public.email_logs
  for select using (public.is_admin());

-- Written only by the cron job's service-role client — nothing for
-- authenticated users to do with this table directly.
create policy invoice_reminders_sent_admin_select on public.invoice_reminders_sent
  for select using (public.is_admin());
