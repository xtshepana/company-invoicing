-- Customer account numbers: keep customers from being mixed up.
--
-- The account number (customers.customer_reference) is also the "Payment Reference" printed on invoices, so customers
-- quote it on their bank payments. Three safeguards:
--   1. Format: only the generated shape (3 capital letters + digits) or blank. This also makes the existing unique
--      index case-proof, since "abc001" and "ABC001" can no longer both exist.
--   2. Lock: an existing customer's account number can never be changed, by the app or by hand. (If one ever has to be
--      corrected, disable the trigger deliberately for that one statement and re-enable it.) Setting a number on a
--      customer that has none yet is still allowed.
--   3. Auto-match: auto_match_bank_transactions used to link a bank line to ANY recorded payment with the same amount
--      within 3 days. Two customers paying the same fixed fee close together could be swapped, with nobody confirming.
--      It now only links when the match is unambiguous.

alter table public.customers
  add constraint customers_customer_reference_format
  check (customer_reference = '' or customer_reference ~ '^[A-Z]{3}[0-9]{3,}$');

create or replace function public.customers_lock_account_number()
returns trigger
language plpgsql
as $$
begin
  if old.customer_reference <> '' and new.customer_reference is distinct from old.customer_reference then
    raise exception 'A customer''s account number cannot be changed once it has been issued.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger customers_lock_account_number
  before update on public.customers
  for each row execute function public.customers_lock_account_number();

-- Same signature and grants as 0020_bank_reconciliation.sql; only the matching rules change:
--   * Candidate payments are those with the same amount, within 3 days, not already linked to a bank line - as before -
--     but a payment is NOT a candidate when the bank line quotes a DIFFERENT customer's account number.
--   * If the bank line quotes the account number of exactly one candidate payment's customer, that payment is linked.
--   * Otherwise a payment is linked only when it is the single candidate AND no other unmatched bank line could equally
--     be it. Anything ambiguous is left unmatched for a person to decide.
create or replace function public.auto_match_bank_transactions(p_batch_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_txn record;
  v_payment_id uuid;
  v_candidates integer;
  v_confirmed integer;
  v_matched_count integer := 0;
begin
  if not public.has_module_access('banking') then
    raise exception 'You do not have access to the banking module.';
  end if;

  for v_txn in
    select id, amount, transaction_date,
           upper(coalesce(description, '') || ' ' || coalesce(reference, '')) as haystack
    from public.bank_transactions
    where status = 'unmatched'
      and amount > 0
      and (p_batch_id is null or import_batch_id = p_batch_id)
    order by transaction_date
  loop
    v_payment_id := null;

    with cand as (
      select p.id,
             exists (
               select 1 from public.customers c
               where c.id = p.customer_id
                 and c.customer_reference <> ''
                 and v_txn.haystack ~ ('(^|[^A-Z0-9])' || c.customer_reference || '([^A-Z0-9]|$)')
             ) as quoted_own
      from public.payments p
      where p.amount = v_txn.amount
        and abs(p.payment_date - v_txn.transaction_date) <= 3
        and not exists (select 1 from public.bank_transactions bt2 where bt2.matched_payment_id = p.id)
        and not exists (
          select 1 from public.customers c
          where c.id <> p.customer_id
            and c.customer_reference <> ''
            and v_txn.haystack ~ ('(^|[^A-Z0-9])' || c.customer_reference || '([^A-Z0-9]|$)')
        )
    )
    select count(*), count(*) filter (where quoted_own), (array_agg(id order by quoted_own desc, id))[1]
    into v_candidates, v_confirmed, v_payment_id
    from cand;

    if v_candidates = 0 or v_confirmed > 1 or (v_confirmed = 0 and v_candidates <> 1) then
      v_payment_id := null;
    elsif v_confirmed = 0 then
      -- a single payment, but not confirmed by an account number: make sure no other unmatched bank line is equally entitled to it
      if exists (
        select 1
        from public.bank_transactions bt, public.payments p
        where p.id = v_payment_id
          and bt.status = 'unmatched'
          and bt.id <> v_txn.id
          and bt.amount = v_txn.amount
          and abs(p.payment_date - bt.transaction_date) <= 3
      ) then
        v_payment_id := null;
      end if;
    end if;

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
