-- Whether the company is currently VAT registered. Defaults to false to
-- match reality right now (not yet registered) - until this is turned on,
-- every new invoice/quote/credit note/recurring invoice is created with
-- VAT forced to 0% server-side (see the create/update actions in
-- server/actions/), regardless of any product's configured vat_rate or
-- what a client might send, so the business never accidentally issues a
-- document charging VAT it isn't legally allowed to charge.
alter table company_settings
  add column vat_registered boolean not null default false;
