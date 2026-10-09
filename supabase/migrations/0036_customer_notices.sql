-- Customer notices: a message written once in the app and emailed to a chosen
-- set of customers (e.g. a company name or banking details change). The
-- message itself and the totals live here; the per-recipient result of each
-- send is already recorded in email_logs (entity = 'customer_notices',
-- entity_id = this row's id), so there's no separate recipients table.
--
-- send_token is generated once per compose-page load and is unique, so a
-- double-click or a resubmitted form can only ever create - and therefore
-- send - one notice.

create table public.customer_notices (
  id uuid primary key default gen_random_uuid(),
  send_token uuid not null unique,
  subject text not null,
  body text not null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  recipient_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index customer_notices_created_at_idx on public.customer_notices (created_at desc);

alter table public.customer_notices enable row level security;

-- Owner/admin only, matching the Users and Audit Log pages: emailing every
-- customer is not something an ordinary staff member should be able to do.
create policy customer_notices_admin_select on public.customer_notices
  for select using (public.is_admin());
create policy customer_notices_admin_insert on public.customer_notices
  for insert with check (public.is_admin());
create policy customer_notices_admin_update on public.customer_notices
  for update using (public.is_admin()) with check (public.is_admin());
