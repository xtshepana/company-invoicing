-- Adds the 'corporate' PDF design (a boxed, form-style layout) to the list of
-- templates a company can pick in Settings > Appearance. Nothing changes for
-- existing documents: the column's default stays 'classic' and every company
-- keeps whatever it has chosen.
alter table public.company_settings drop constraint company_settings_pdf_template_check;
alter table public.company_settings
  add constraint company_settings_pdf_template_check
  check (pdf_template in ('classic', 'modern', 'minimal', 'bold', 'elegant', 'corporate'));
