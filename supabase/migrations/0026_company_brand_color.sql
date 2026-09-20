-- Optional brand accent color (hex, e.g. #2563eb), applied to both the app
-- UI theme and the PDF documents. Null means "use the default neutral theme".
alter table company_settings
  add column brand_color text;

alter table company_settings
  add constraint company_settings_brand_color_format
  check (brand_color is null or brand_color ~ '^#[0-9a-fA-F]{6}$');
