-- The exact same bug as 0014_fix_payment_status_enum_cast.sql, reintroduced
-- by accident: 0020_bank_reconciliation.sql had to DROP + CREATE
-- record_payment() to add its two new trailing params (p_source,
-- p_bank_transaction_id) — Postgres treats a changed parameter list as a
-- new overload, so a plain CREATE OR REPLACE couldn't have done it — and
-- that rewrite was based on the ORIGINAL 0012 function body, not the
-- 0014-patched one, silently dropping the `::public.invoice_status` cast
-- on the invoice-status UPDATE along the way.
--
-- Caught by the Playwright e2e suite exercising an *allocated* payment
-- (auto-allocate to an invoice) for the first time since the Phase 6
-- rewrite — every manual test of record_payment() during Phase 6 only
-- ever used unallocated payments (no invoice_allocations), so this
-- specific code path never ran. The error was exactly the historical one:
-- "column \"status\" is of type invoice_status but expression is of type
-- text". General lesson restated once more: **any migration that
-- DROP + CREATEs a function to change its signature must diff against the
-- function's most recently patched body, not whatever version happens to
-- be handy — grep the full migration history for the function name first.**
create or replace function public.record_payment(
  p_customer_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_bank_reference text,
  p_description text,
  p_notes text,
  p_invoice_allocations jsonb,
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
      status = (case
        when amount_paid + v_alloc_amount >= total then 'paid'
        else 'partially_paid'
      end)::public.invoice_status
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
