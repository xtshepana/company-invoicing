-- RLS for quotes/invoices and their line items. Same defense-in-depth
-- caveat as prior migrations — server actions independently call
-- requireModuleAccess() too.

alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_items enable row level security;

create policy quotes_select on public.quotes
  for select using (public.has_module_access('quotes'));
create policy quotes_insert on public.quotes
  for insert with check (public.has_module_access('quotes'));
create policy quotes_update on public.quotes
  for update using (public.has_module_access('quotes')) with check (public.has_module_access('quotes'));

-- Quote line items are only ever managed through their parent quote, by
-- someone with quotes access — never edited as a standalone resource.
create policy quote_items_select on public.quote_items
  for select using (public.has_module_access('quotes'));
create policy quote_items_insert on public.quote_items
  for insert with check (public.has_module_access('quotes'));
create policy quote_items_update on public.quote_items
  for update using (public.has_module_access('quotes')) with check (public.has_module_access('quotes'));
create policy quote_items_delete on public.quote_items
  for delete using (public.has_module_access('quotes'));

create policy invoices_select on public.invoices
  for select using (public.has_module_access('invoices'));
create policy invoices_insert on public.invoices
  for insert with check (public.has_module_access('invoices'));
create policy invoices_update on public.invoices
  for update using (public.has_module_access('invoices')) with check (public.has_module_access('invoices'));

create policy invoice_items_select on public.invoice_items
  for select using (public.has_module_access('invoices'));
create policy invoice_items_insert on public.invoice_items
  for insert with check (public.has_module_access('invoices'));
create policy invoice_items_update on public.invoice_items
  for update using (public.has_module_access('invoices')) with check (public.has_module_access('invoices'));
create policy invoice_items_delete on public.invoice_items
  for delete using (public.has_module_access('invoices'));
