-- Apply after savings.sql and user_profiles.sql.
-- Additive and safe to run more than once.
alter table public.user_profiles
  add column if not exists monthly_income numeric
    check (monthly_income is null or (monthly_income > 0 and monthly_income < 'Infinity'::numeric)),
  add column if not exists monthly_income_currency text
    check (monthly_income_currency is null or monthly_income_currency ~ '^[A-Z]{3}$'),
  add column if not exists savings_percentage smallint not null default 20
    check (savings_percentage in (10, 20, 30));

alter table public.savings
  add column if not exists record_type text not null default 'contribution'
    check (record_type in ('contribution', 'transfer')),
  add column if not exists request_id uuid;

create unique index if not exists savings_user_request_id_idx
  on public.savings (user_id, request_id)
  where request_id is not null;
