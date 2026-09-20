-- Row Level Security. Defense in depth only — every server action/route
-- handler that touches this data must independently verify authorization
-- too (see server/services/auth.ts).

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'owner_admin' and is_active
  );
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and is_active
  );
$$;

create or replace function public.current_role_name()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

alter table public.profiles enable row level security;
alter table public.company_settings enable row level security;
alter table public.audit_logs enable row level security;

-- profiles: everyone can see the staff directory (names/roles are not
-- sensitive within a single company); only admins can change roles/status;
-- a user may update their own non-role fields.
create policy profiles_select_active_staff on public.profiles
  for select
  using (public.is_active_staff());

create policy profiles_update_self_basic on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_all on public.profiles
  for all
  using (public.is_admin())
  with check (public.is_admin());

-- The "update self" policy above only restricts which ROW a non-admin can
-- touch, not which COLUMNS — without this trigger a user could update their
-- own row and grant themselves owner_admin. Block role/status/permission
-- changes unless the caller is already an admin.
create or replace function public.prevent_self_privilege_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.is_active is distinct from old.is_active
     or new.staff_module_permissions is distinct from old.staff_module_permissions then
    raise exception 'Only an administrator can change role, status, or permissions.';
  end if;

  return new;
end;
$$;

create trigger profiles_prevent_self_privilege_escalation
  before update on public.profiles
  for each row execute function public.prevent_self_privilege_escalation();

-- company_settings: readable by any active staff member, writable by admins only.
create policy company_settings_select_active_staff on public.company_settings
  for select
  using (public.is_active_staff());

create policy company_settings_admin_update on public.company_settings
  for update
  using (public.is_admin())
  with check (public.is_admin());

-- audit_logs: admin-read-only. No insert/update/delete policy exists for the
-- authenticated role at all, so normal application code can never write or
-- edit an audit record directly — only the service-role client can (used by
-- server/services/audit.ts, which bypasses RLS by design).
create policy audit_logs_admin_select on public.audit_logs
  for select
  using (public.is_admin());
