-- Same bug class as 0004_fix_handle_new_user_enum_cast.sql: a CASE
-- expression with two unadorned text literal branches resolves to `text`,
-- not the target enum column's type, and Postgres won't implicitly cast it
-- on UPDATE. This broke every payment allocation and every credit
-- application ("column \"status\" is of type invoice_status but expression
-- is of type text"), caught by actually recording a payment rather than
-- just unit-testing the validation schema.

create or replace function public.record_payment(
  p_customer_id uuid,
  p_payment_date date,
  p_amount numeric,
  p_payment_method public.payment_method,
  p_bank_reference text,
  p_description text,
  p_notes text,
  p_invoice_allocations jsonb
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
  end::public.payment_allocation_status;

  insert into public.payments (
    customer_id, payment_date, amount, payment_method, bank_reference, description, notes, allocation_status, created_by
  )
  values (
    p_customer_id, p_payment_date, p_amount, p_payment_method, p_bank_reference, p_description, p_notes, v_allocation_status, auth.uid()
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

  return v_payment_id;
end;
$$;

create or replace function public.apply_customer_credit(
  p_customer_id uuid,
  p_invoice_id uuid,
  p_amount numeric,
  p_notes text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invoice_customer_id uuid;
  v_invoice_balance numeric;
  v_invoice_total numeric;
  v_invoice_amount_paid numeric;
  v_invoice_status public.invoice_status;
  v_credit_balance numeric;
begin
  if not public.has_module_access('payments') then
    raise exception 'You do not have access to the payments module.';
  end if;
  if p_amount <= 0 then
    raise exception 'Amount must be greater than zero.';
  end if;

  select coalesce(sum(amount), 0) into v_credit_balance
  from public.customer_credits
  where customer_id = p_customer_id;

  if p_amount > v_credit_balance then
    raise exception 'This customer only has % in available credit.', v_credit_balance;
  end if;

  select customer_id, balance_due, total, amount_paid, status
  into v_invoice_customer_id, v_invoice_balance, v_invoice_total, v_invoice_amount_paid, v_invoice_status
  from public.invoices
  where id = p_invoice_id
  for update;

  if v_invoice_customer_id is null then
    raise exception 'Invoice not found.';
  end if;
  if v_invoice_customer_id <> p_customer_id then
    raise exception 'Invoice does not belong to this customer.';
  end if;
  if v_invoice_status in ('cancelled', 'void') then
    raise exception 'Cannot apply credit to a cancelled or voided invoice.';
  end if;
  if p_amount > v_invoice_balance then
    raise exception 'Amount (%) exceeds invoice outstanding balance (%).', p_amount, v_invoice_balance;
  end if;

  insert into public.customer_credits (customer_id, amount, source, invoice_id, notes)
  values (p_customer_id, -p_amount, 'applied_to_invoice', p_invoice_id, p_notes);

  update public.invoices
  set
    amount_paid = amount_paid + p_amount,
    status = (case
      when amount_paid + p_amount >= total then 'paid'
      else 'partially_paid'
    end)::public.invoice_status
  where id = p_invoice_id;
end;
$$;
