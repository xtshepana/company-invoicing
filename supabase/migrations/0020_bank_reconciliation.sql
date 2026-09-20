-- Bank statement import & reconciliation. A bank transaction is either
-- linked to a payment that already exists (the common case when staff
-- capture a payment as soon as a customer tells them about it, and later
-- confirm it cleared) or used to create a brand new payment directly from
-- the reconciliation screen (the common case when the bank feed is the
-- first record of the payment). Either way, `payments` itself is only ever
-- written through record_payment() — reconciliation never bypasses it.

create type public.bank_transaction_status as enum ('unmatched', 'matched', 'ignored');

create table public.bank_import_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  imported_by uuid references public.profiles(id),
  row_count integer not null,
  imported_count integer not null default 0,
  duplicate_count integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.bank_import_batches(id),
  transaction_date date not null,
  description text not null,
  reference text,
  amount numeric(14, 2) not null,
  balance_after numeric(14, 2),
  -- Deterministic per-row hash so re-importing an overlapping statement
  -- (a common real workflow: exporting "last 30 days" every week) is a
  -- silent no-op for rows already seen, not a duplicate transaction.
  dedupe_hash text not null unique,
  status public.bank_transaction_status not null default 'unmatched',
  matched_payment_id uuid references public.payments(id),
  matched_at timestamptz,
  matched_by uuid references public.profiles(id),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create index bank_transactions_status_idx on public.bank_transactions(status);
create index bank_transactions_import_batch_id_idx on public.bank_transactions(import_batch_id);
create unique index bank_transactions_matched_payment_id_key on public.bank_transactions(matched_payment_id) where matched_payment_id is not null;

alter table public.bank_import_batches enable row level security;
alter table public.bank_transactions enable row level security;

create policy bank_import_batches_select on public.bank_import_batches
  for select
  using (public.has_module_access('banking'));

create policy bank_transactions_select on public.bank_transactions
  for select
  using (public.has_module_access('banking'));

-- Ignore/unignore are the one state change simple enough not to need an
-- RPC (no cross-table invariant to protect, unlike matching). Match/unmatch
-- still go through functions below since they touch payments too.
create policy bank_transactions_update on public.bank_transactions
  for update
  using (public.has_module_access('banking'))
  with check (public.has_module_access('banking'));

-- Row + row-count import, skipping rows already seen (by dedupe_hash)
-- rather than failing the whole batch.
create or replace function public.import_bank_transactions(p_filename text, p_rows jsonb)
returns table(batch_id uuid, imported_count integer, duplicate_count integer, row_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_batch_id uuid;
  v_row_count integer;
  v_imported_count integer;
begin
  if not public.has_module_access('banking') then
    raise exception 'You do not have access to the banking module.';
  end if;

  v_row_count := jsonb_array_length(p_rows);
  if v_row_count = 0 then
    raise exception 'No rows to import.';
  end if;

  insert into public.bank_import_batches (filename, imported_by, row_count)
  values (p_filename, auth.uid(), v_row_count)
  returning id into v_batch_id;

  insert into public.bank_transactions (
    import_batch_id, transaction_date, description, reference, amount, balance_after, dedupe_hash
  )
  select
    v_batch_id,
    (row ->> 'transaction_date')::date,
    row ->> 'description',
    nullif(row ->> 'reference', ''),
    (row ->> 'amount')::numeric,
    nullif(row ->> 'balance_after', '')::numeric,
    md5(
      (row ->> 'transaction_date') || '|' || (row ->> 'description') || '|' ||
      (row ->> 'amount') || '|' || coalesce(row ->> 'reference', '')
    )
  from jsonb_array_elements(p_rows) as row
  on conflict (dedupe_hash) do nothing;

  get diagnostics v_imported_count = row_count;

  update public.bank_import_batches
  set imported_count = v_imported_count, duplicate_count = v_row_count - v_imported_count
  where id = v_batch_id;

  return query select v_batch_id, v_imported_count, (v_row_count - v_imported_count), v_row_count;
end;
$$;

-- Links a bank transaction to a payment that already exists (never
-- creates one). One-to-one: a payment already claimed by another
-- transaction can't be claimed again (enforced here for a clean error
-- message, and by the unique index above regardless).
create or replace function public.match_bank_transaction(p_transaction_id uuid, p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_module_access('banking') then
    raise exception 'You do not have access to the banking module.';
  end if;

  if not exists (select 1 from public.bank_transactions where id = p_transaction_id) then
    raise exception 'Bank transaction not found.';
  end if;
  if not exists (select 1 from public.payments where id = p_payment_id) then
    raise exception 'Payment not found.';
  end if;
  if exists (
    select 1 from public.bank_transactions
    where matched_payment_id = p_payment_id and id <> p_transaction_id
  ) then
    raise exception 'That payment is already matched to a different bank transaction.';
  end if;

  update public.bank_transactions
  set status = 'matched', matched_payment_id = p_payment_id, matched_at = now(), matched_by = auth.uid()
  where id = p_transaction_id;
end;
$$;

create or replace function public.unmatch_bank_transaction(p_transaction_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_module_access('banking') then
    raise exception 'You do not have access to the banking module.';
  end if;

  update public.bank_transactions
  set status = 'unmatched', matched_payment_id = null, matched_at = null, matched_by = null
  where id = p_transaction_id;
end;
$$;

-- Only links transactions to payments that already exist — it never
-- creates a payment, so it can never misfire into a wrong invoice
-- allocation. Matches by exact amount within a 3-day window, closest
-- date first; each transaction/payment is claimed at most once because
-- later iterations see earlier updates within the same call (same
-- transaction, read-your-own-writes).
create or replace function public.auto_match_bank_transactions(p_batch_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn record;
  v_payment_id uuid;
  v_matched_count integer := 0;
begin
  if not public.has_module_access('banking') then
    raise exception 'You do not have access to the banking module.';
  end if;

  for v_txn in
    select id, amount, transaction_date
    from public.bank_transactions
    where status = 'unmatched'
      and amount > 0
      and (p_batch_id is null or import_batch_id = p_batch_id)
    order by transaction_date
  loop
    select p.id into v_payment_id
    from public.payments p
    where p.amount = v_txn.amount
      and abs(p.payment_date - v_txn.transaction_date) <= 3
      and not exists (
        select 1 from public.bank_transactions bt2 where bt2.matched_payment_id = p.id
      )
    order by abs(p.payment_date - v_txn.transaction_date), p.payment_date
    limit 1;

    if v_payment_id is not null then
      update public.bank_transactions
      set status = 'matched', matched_payment_id = v_payment_id, matched_at = now(), matched_by = auth.uid()
      where id = v_txn.id;
      v_matched_count := v_matched_count + 1;
    end if;
  end loop;

  return v_matched_count;
end;
$$;

revoke execute on function public.import_bank_transactions(text, jsonb) from public;
revoke execute on function public.import_bank_transactions(text, jsonb) from anon;
grant execute on function public.import_bank_transactions(text, jsonb) to authenticated;

revoke execute on function public.match_bank_transaction(uuid, uuid) from public;
revoke execute on function public.match_bank_transaction(uuid, uuid) from anon;
grant execute on function public.match_bank_transaction(uuid, uuid) to authenticated;

revoke execute on function public.unmatch_bank_transaction(uuid) from public;
revoke execute on function public.unmatch_bank_transaction(uuid) from anon;
grant execute on function public.unmatch_bank_transaction(uuid) to authenticated;

revoke execute on function public.auto_match_bank_transactions(uuid) from public;
revoke execute on function public.auto_match_bank_transactions(uuid) from anon;
grant execute on function public.auto_match_bank_transactions(uuid) to authenticated;

-- record_payment gains two optional trailing params so reconciliation can
-- create a payment straight from a bank transaction (source =
-- 'bank_reconciliation', tagged and linked in the same atomic call) while
-- every existing caller (the plain Record Payment form) keeps working
-- unchanged via the defaults. This must be a drop + recreate, not a bare
-- create-or-replace: Postgres treats a different parameter list as a
-- distinct overload, which would leave the old 8-arg version callable
-- alongside this one rather than replacing it.
drop function if exists public.record_payment(uuid, date, numeric, public.payment_method, text, text, text, jsonb);

create or replace function public.record_payment(
  p_customer_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_bank_reference text,
  p_description text,
  p_notes text,
  p_invoice_allocations jsonb, -- [{ invoice_id, amount }]
  p_source text default 'manual',
  p_bank_transaction_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment_id uuid;
  v_alloc jsonb;
  v_invoice_id uuid;
  v_alloc_amount numeric;
  v_invoice_customer_id uuid;
  v_invoice_balance numeric;
  v_invoice_total numeric;
  v_invoice_amount_paid numeric;
  v_invoice_status public.invoice_status;
  v_sum_alloc numeric := 0;
  v_credit_amount numeric;
  v_allocation_status public.payment_allocation_status;
begin
  if not public.has_module_access('payments') then
    raise exception 'You do not have access to the payments module.';
  end if;
  if p_amount <= 0 then
    raise exception 'Payment amount must be greater than zero.';
  end if;

  if p_bank_transaction_id is not null then
    if not public.has_module_access('banking') then
      raise exception 'You do not have access to the banking module.';
    end if;
    if not exists (
      select 1 from public.bank_transactions where id = p_bank_transaction_id and status = 'unmatched'
    ) then
      raise exception 'This bank transaction is no longer available to match (it may already be matched).';
    end if;
  end if;

  for v_alloc in select * from jsonb_array_elements(coalesce(p_invoice_allocations, '[]'::jsonb))
  loop
    v_sum_alloc := v_sum_alloc + (v_alloc ->> 'amount')::numeric;
  end loop;

  if v_sum_alloc > p_amount then
    raise exception 'Allocation total (%) cannot exceed the payment amount (%).', v_sum_alloc, p_amount;
  end if;

  v_credit_amount := p_amount - v_sum_alloc;
  v_allocation_status := case
    when v_sum_alloc = 0 then 'unallocated'
    when v_credit_amount > 0 then 'partially_allocated'
    else 'fully_allocated'
  end;

  insert into public.payments (
    customer_id, payment_date, amount, payment_method, bank_reference, description, notes,
    allocation_status, source, created_by
  )
  values (
    p_customer_id, p_payment_date, p_amount, p_payment_method, p_bank_reference, p_description, p_notes,
    v_allocation_status, p_source, auth.uid()
  )
  returning id into v_payment_id;

  for v_alloc in select * from jsonb_array_elements(coalesce(p_invoice_allocations, '[]'::jsonb))
  loop
    v_invoice_id := (v_alloc ->> 'invoice_id')::uuid;
    v_alloc_amount := (v_alloc ->> 'amount')::numeric;

    if v_alloc_amount <= 0 then
      raise exception 'Allocation amounts must be greater than zero.';
    end if;

    select customer_id, balance_due, total, amount_paid, status
    into v_invoice_customer_id, v_invoice_balance, v_invoice_total, v_invoice_amount_paid, v_invoice_status
    from public.invoices
    where id = v_invoice_id
    for update;

    if v_invoice_customer_id is null then
      raise exception 'Invoice not found.';
    end if;
    if v_invoice_customer_id <> p_customer_id then
      raise exception 'Invoice does not belong to this customer.';
    end if;
    if v_invoice_status in ('cancelled', 'void') then
      raise exception 'Cannot allocate a payment to a cancelled or voided invoice.';
    end if;
    if v_alloc_amount > v_invoice_balance then
      raise exception 'Allocation (%) exceeds invoice outstanding balance (%).', v_alloc_amount, v_invoice_balance;
    end if;

    insert into public.payment_allocations (payment_id, invoice_id, amount, created_by)
    values (v_payment_id, v_invoice_id, v_alloc_amount, auth.uid());

    update public.invoices
    set
      amount_paid = amount_paid + v_alloc_amount,
      status = case
        when amount_paid + v_alloc_amount >= total then 'paid'
        else 'partially_paid'
      end
    where id = v_invoice_id;
  end loop;

  if v_credit_amount > 0 then
    insert into public.customer_credits (customer_id, amount, source, payment_id, notes)
    values (p_customer_id, v_credit_amount, 'overpayment', v_payment_id, 'Overpayment from payment recorded ' || p_payment_date);
  end if;

  if p_bank_transaction_id is not null then
    update public.bank_transactions
    set status = 'matched', matched_payment_id = v_payment_id, matched_at = now(), matched_by = auth.uid()
    where id = p_bank_transaction_id;
  end if;

  return v_payment_id;
end;
$$;

revoke execute on function public.record_payment(uuid, date, numeric, public.payment_method, text, text, text, jsonb, text, uuid) from public;
revoke execute on function public.record_payment(uuid, date, numeric, public.payment_method, text, text, text, jsonb, text, uuid) from anon;
grant execute on function public.record_payment(uuid, date, numeric, public.payment_method, text, text, text, jsonb, text, uuid) to authenticated;
