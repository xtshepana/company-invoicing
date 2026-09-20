-- Address advisor warnings from 0001/0002: a mutable search_path on a
-- SECURITY DEFINER-adjacent trigger function, and trigger-only functions
-- left callable as public RPCs via PostgREST.

alter function public.set_updated_at() set search_path = public;

-- These two are trigger functions only; nothing should ever call them
-- directly over the API.
revoke execute on function public.handle_new_auth_user() from public, anon, authenticated;
revoke execute on function public.prevent_self_privilege_escalation() from public, anon, authenticated;

-- These are safe for a signed-in user to call (they only ever look up the
-- caller's own row via auth.uid()), but anonymous callers have no auth.uid()
-- and no legitimate reason to call them.
revoke execute on function public.is_admin() from anon;
revoke execute on function public.is_active_staff() from anon;
revoke execute on function public.current_role_name() from anon;
