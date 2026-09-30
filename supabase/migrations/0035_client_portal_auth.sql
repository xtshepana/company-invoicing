-- Client portal: magic-link authentication for customers, wholly separate
-- from Supabase Auth (which is staff-only - see profiles/is_admin()).
-- Customers never get a Supabase session, so no RLS policy can grant them
-- row access the way is_admin()/has_module_access() do for staff. Every
-- client-portal query instead goes through the service-role client with
-- the session's customer_ids manually verified against the row being
-- read - see server/services/client-auth.ts (added in a later change).
--
-- customers.email has no uniqueness constraint, so a session is scoped to
-- an array of customer_ids (every customer row matching the email at
-- login time), not a single id - this avoids silently picking one
-- customer and hiding the others if an email is ever reused across rows.
-- Only token hashes are stored; the raw token only ever exists in the
-- magic-link URL and the session cookie, never in the database.

create table public.client_magic_links (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  customer_ids uuid[] not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create index client_magic_links_expires_at_idx on public.client_magic_links (expires_at);

create table public.client_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email text not null,
  customer_ids uuid[] not null,
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index client_sessions_expires_at_idx on public.client_sessions (expires_at);

alter table public.client_magic_links enable row level security;
alter table public.client_sessions enable row level security;

-- Admin-only visibility for support/debugging (e.g. "did this client's
-- link get created", "is their session still active"). No insert/update/
-- delete policy for anyone - these are written only by the service-role
-- client from server code, same append-only-from-the-server pattern as
-- audit_logs and email_logs.
create policy client_magic_links_admin_select on public.client_magic_links
  for select using (public.is_admin());
create policy client_sessions_admin_select on public.client_sessions
  for select using (public.is_admin());
