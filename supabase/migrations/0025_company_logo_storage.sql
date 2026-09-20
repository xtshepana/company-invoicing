-- Storage bucket for the company logo shown on invoices/quotes/credit
-- notes/statements. Public read (PDFs and the browser both fetch it by
-- URL with no auth header), admin-only write via storage.objects RLS.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('company-assets', 'company-assets', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'])
on conflict (id) do nothing;

create policy "company_assets_public_read"
  on storage.objects for select
  using (bucket_id = 'company-assets');

create policy "company_assets_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'company-assets' and public.is_admin());

create policy "company_assets_admin_update"
  on storage.objects for update
  using (bucket_id = 'company-assets' and public.is_admin())
  with check (bucket_id = 'company-assets' and public.is_admin());

create policy "company_assets_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'company-assets' and public.is_admin());
