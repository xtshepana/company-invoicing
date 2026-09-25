-- Which visual design invoices/quotes/credit notes are rendered with.
-- Defaults to 'classic' (the original, only design that existed before
-- this migration) so nothing changes for existing documents until someone
-- deliberately picks something else in Settings > Appearance.
alter table company_settings
  add column pdf_template text not null default 'classic'
  check (pdf_template in ('classic', 'modern', 'minimal', 'bold', 'elegant'));
