-- Optional migration: Concurrency-safe savings transfer RPC function
-- This PostgreSQL function atomically validates available balance against
-- total income, total expenses, and prior savings transfers before inserting.
-- Safe and additive to run on Supabase SQL Editor.

create or replace function public.record_savings_transfer(
  p_amount numeric,
  p_currency text default 'INR',
  p_description text default 'Transfer to savings',
  p_savings_date date default current_date,
  p_request_id uuid default null
)
returns public.savings
language plpgsql
security invoker
as $$
declare
  v_user_id uuid;
  v_total_income numeric := 0;
  v_total_expenses numeric := 0;
  v_total_savings numeric := 0;
  v_available_balance numeric := 0;
  v_result public.savings;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_amount <= 0 then
    raise exception 'Savings amount must be positive';
  end if;

  -- Idempotency check if request_id provided
  if p_request_id is not null then
    select * into v_result
    from public.savings
    where user_id = v_user_id and request_id = p_request_id;

    if found then
      return v_result;
    end if;
  end if;

  -- Calculate current totals from expenses table
  select coalesce(sum(case when transaction_type = 'income' then amount else 0 end), 0),
         coalesce(sum(case when transaction_type = 'expense' then amount else 0 end), 0)
  into v_total_income, v_total_expenses
  from public.expenses
  where user_id = v_user_id;

  -- Calculate existing savings transfers
  select coalesce(sum(amount), 0)
  into v_total_savings
  from public.savings
  where user_id = v_user_id and record_type = 'transfer';

  v_available_balance := v_total_income - v_total_expenses - v_total_savings;

  if p_amount > v_available_balance then
    raise exception 'Savings transfer of % exceeds available balance of %', p_amount, v_available_balance;
  end if;

  insert into public.savings (
    user_id,
    amount,
    currency,
    description,
    savings_date,
    record_type,
    request_id
  )
  values (
    v_user_id,
    p_amount,
    p_currency,
    coalesce(p_description, 'Transfer to savings'),
    coalesce(p_savings_date, current_date),
    'transfer',
    p_request_id
  )
  returning * into v_result;

  return v_result;
end;
$$;

grant execute on function public.record_savings_transfer(numeric, text, text, date, uuid) to authenticated;
