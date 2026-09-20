-- Bug fix: the CASE expression in handle_new_auth_user resolved to `text`
-- (both branches are unadorned string literals, so Postgres types the CASE
-- as text rather than picking up the target column's enum type), and text
-- has no implicit cast to public.user_role. This made every single signup
-- fail with "column \"role\" is of type user_role but expression is of type
-- text" (auth.users insert rolled back entirely, so no user was ever
-- created — this was never triggered by our test suite since it only
-- exercises the trigger's SQL indirectly through migrations, never an
-- actual auth signup). Fix: cast the CASE result explicitly.

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  is_first_user boolean;
begin
  select not exists(select 1 from public.profiles) into is_first_user;

  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    (case when is_first_user then 'owner_admin' else 'staff' end)::public.user_role
  );

  return new;
end;
$$;
