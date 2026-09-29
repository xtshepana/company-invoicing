-- Whether the company name text is shown on generated PDFs, alongside the
-- logo. Defaults to true so nothing changes until someone deliberately
-- turns it off in Settings > Appearance (e.g. because their logo already
-- includes the company name and showing both looks redundant).
alter table company_settings
  add column show_company_name boolean not null default true;
