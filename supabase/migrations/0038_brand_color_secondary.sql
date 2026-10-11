-- A second brand colour, picked from the company logo when it is uploaded (brand_color is the primary one).
-- Corporate uses both; the other colour templates use the primary.
alter table public.company_settings
  add column brand_color_secondary text;

alter table public.company_settings
  add constraint company_settings_brand_color_secondary_format
  check (brand_color_secondary is null or brand_color_secondary ~ '^#[0-9a-fA-F]{6}$');
