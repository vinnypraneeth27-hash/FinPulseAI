-- Financial Health Score schema preparation.
-- Review before applying. This migration does not backfill transaction currency
-- or classify any existing savings row as emergency savings.
begin;

do $$
begin
  if to_regclass('public.expenses') is null then
    raise exception 'Required table public.expenses was not found.';
  end if;
  if to_regclass('public.savings') is null then
    raise exception 'Required table public.savings was not found.';
  end if;
end;
$$;

-- Existing expense currencies are intentionally left NULL unless explicitly
-- recorded when the transaction is created or edited.
alter table public.expenses
  add column if not exists currency text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and conname = 'expenses_currency_format_check'
  ) then
    alter table public.expenses
      add constraint expenses_currency_format_check
      check (currency is null or currency ~ '^[A-Z]{3}$') not valid;
  end if;
end;
$$;

alter table public.expenses
  validate constraint expenses_currency_format_check;

alter table public.savings
  add column if not exists is_emergency boolean not null default false;

-- Replace only record_type checks that encode the old allowed-value list.
-- Other savings constraints and all existing records are preserved.
do $$
declare
  existing_check record;
  constrained_columns text[];
begin
  for existing_check in
    select conname, conkey, pg_get_constraintdef(oid) as definition
    from pg_constraint
    where conrelid = 'public.savings'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%record_type%'
  loop
    select array_agg(attribute.attname::text order by attribute.attname)
      into constrained_columns
    from unnest(existing_check.conkey) as key(attnum)
    join pg_attribute attribute
      on attribute.attrelid = 'public.savings'::regclass
     and attribute.attnum = key.attnum;

    if constrained_columns is distinct from array['record_type']::text[] then
      raise exception
        'Savings constraint % also governs other columns; review it before changing record_type checks.',
        existing_check.conname;
    end if;

    execute format(
      'alter table public.savings drop constraint %I',
      existing_check.conname
    );
  end loop;

  alter table public.savings
    add constraint savings_record_type_allowed_check
    check (record_type in ('contribution', 'transfer', 'withdrawal')) not valid;
  alter table public.savings
    validate constraint savings_record_type_allowed_check;
end;
$$;

create table if not exists public.user_budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (length(btrim(category)) > 0),
  amount numeric not null check (amount > 0 and amount < 'Infinity'::numeric),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  period_start date not null check (extract(day from period_start) = 1),
  is_essential boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_budgets_user_category_month_currency_key
    unique (user_id, category, period_start, currency)
);

-- Replace any legacy category/month uniqueness that would prevent storing
-- separate budgets in different currencies, including equivalent constraints
-- created under a different name.
do $$
declare
  unique_constraint record;
  constraint_columns text[];
  unique_index record;
  index_columns text[];
  has_currency_unique boolean := false;
begin
  for unique_constraint in
    select conname, conkey
    from pg_constraint
    where conrelid = 'public.user_budgets'::regclass
      and contype = 'u'
  loop
    select array_agg(attribute.attname::text order by attribute.attname)
      into constraint_columns
    from unnest(unique_constraint.conkey) as key(attnum)
    join pg_attribute attribute
      on attribute.attrelid = 'public.user_budgets'::regclass
     and attribute.attnum = key.attnum;

    if constraint_columns = array['category', 'period_start', 'user_id']::text[] then
      execute format(
        'alter table public.user_budgets drop constraint %I',
        unique_constraint.conname
      );
    elsif constraint_columns = array['category', 'currency', 'period_start', 'user_id']::text[] then
      has_currency_unique := true;
    end if;
  end loop;

  for unique_index in
    select index_class.relname as index_name, index_data.indkey, index_data.indnkeyatts
    from pg_index index_data
    join pg_class index_class on index_class.oid = index_data.indexrelid
    join pg_namespace index_schema on index_schema.oid = index_class.relnamespace
    where index_data.indrelid = 'public.user_budgets'::regclass
      and index_data.indisunique
      and not index_data.indisprimary
      and index_schema.nspname = 'public'
      and not exists (
        select 1
        from pg_constraint constraint_data
        where constraint_data.conindid = index_data.indexrelid
      )
  loop
    select array_agg(attribute.attname::text order by attribute.attname)
      into index_columns
    from unnest(unique_index.indkey) with ordinality as key(attnum, ordinal)
    join pg_attribute attribute
      on attribute.attrelid = 'public.user_budgets'::regclass
     and attribute.attnum = key.attnum
    where key.ordinal <= unique_index.indnkeyatts;

    if index_columns = array['category', 'period_start', 'user_id']::text[] then
      execute format('drop index public.%I', unique_index.index_name);
    elsif index_columns = array['category', 'currency', 'period_start', 'user_id']::text[] then
      has_currency_unique := true;
    end if;
  end loop;

  if exists (
    select 1
    from public.user_budgets
    group by user_id, category, period_start, currency
    having count(*) > 1
  ) then
    raise exception 'Duplicate user/category/month/currency budgets exist; review them before adding budget uniqueness.';
  end if;

  if not has_currency_unique then
    alter table public.user_budgets
      add constraint user_budgets_user_category_month_currency_key
      unique (user_id, category, period_start, currency);
  end if;
end;
$$;

create index if not exists user_budgets_user_period_idx
  on public.user_budgets (user_id, period_start desc);

create or replace function public.finpulse_set_user_budget_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists finpulse_user_budgets_updated_at on public.user_budgets;
create trigger finpulse_user_budgets_updated_at
  before update on public.user_budgets
  for each row
  execute function public.finpulse_set_user_budget_updated_at();

alter table public.user_budgets enable row level security;

grant select, insert, update, delete on public.user_budgets to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_budgets'
      and policyname = 'user_budgets_select_own'
  ) then
    create policy user_budgets_select_own
      on public.user_budgets
      for select to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_budgets'
      and policyname = 'user_budgets_insert_own'
  ) then
    create policy user_budgets_insert_own
      on public.user_budgets
      for insert to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_budgets'
      and policyname = 'user_budgets_update_own'
  ) then
    create policy user_budgets_update_own
      on public.user_budgets
      for update to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'user_budgets'
      and policyname = 'user_budgets_delete_own'
  ) then
    create policy user_budgets_delete_own
      on public.user_budgets
      for delete to authenticated
      using (auth.uid() = user_id);
  end if;
end;
$$;

create table if not exists public.financial_health_scores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  assessment_type text not null,
  assessment_month date,
  score integer,
  coverage_percentage numeric not null
    constraint financial_health_scores_coverage_range_check
    check (coverage_percentage >= 0 and coverage_percentage <= 100),
  available_weight numeric not null
    constraint financial_health_scores_available_weight_range_check
    check (available_weight >= 0 and available_weight <= 100),
  status text not null,
  component_scores jsonb not null default '{}'::jsonb
    check (jsonb_typeof(component_scores) = 'object'),
  calculation_version text not null,
  calculated_at timestamptz not null default now(),
  constraint financial_health_scores_score_range_check
    check (score is null or score between 0 and 100),
  constraint financial_health_scores_assessment_type_check
    check (
      (assessment_type = 'live' and assessment_month is null)
      or (
        assessment_type = 'monthly'
        and assessment_month is not null
        and extract(day from assessment_month) = 1
      )
    ),
  constraint financial_health_scores_status_check
    check (status in ('ready', 'insufficient_data')),
  constraint financial_health_scores_status_score_consistency_check
    check (
      (status = 'ready' and score is not null)
      or (status = 'insufficient_data' and score is null)
    )
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.financial_health_scores'::regclass
      and conname = 'financial_health_scores_status_score_consistency_check'
  ) then
    alter table public.financial_health_scores
      add constraint financial_health_scores_status_score_consistency_check
      check (
        (status = 'ready' and score is not null)
        or (status = 'insufficient_data' and score is null)
      ) not valid;
    alter table public.financial_health_scores
      validate constraint financial_health_scores_status_score_consistency_check;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from public.financial_health_scores
    group by user_id
    having count(*) filter (where assessment_type = 'live') > 1
  ) or exists (
    select 1
    from public.financial_health_scores
    where assessment_type = 'monthly'
    group by user_id, assessment_month
    having count(*) > 1
  ) then
    raise exception 'Duplicate score assessment identities exist; review them before creating unique indexes.';
  end if;
end;
$$;

drop index if exists public.financial_health_scores_live_user_version_idx;
drop index if exists public.financial_health_scores_month_user_version_idx;

create unique index if not exists financial_health_scores_live_user_idx
  on public.financial_health_scores (user_id)
  where assessment_type = 'live';

create unique index if not exists financial_health_scores_month_user_idx
  on public.financial_health_scores (user_id, assessment_month)
  where assessment_type = 'monthly';

create index if not exists financial_health_scores_user_month_idx
  on public.financial_health_scores (user_id, assessment_month desc, calculated_at desc);

alter table public.financial_health_scores enable row level security;

revoke all on public.financial_health_scores from anon, authenticated;
grant select on public.financial_health_scores to authenticated;
grant select, insert, update on public.financial_health_scores to service_role;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'financial_health_scores'
      and policyname = 'financial_health_scores_select_own'
  ) then
    create policy financial_health_scores_select_own
      on public.financial_health_scores
      for select to authenticated
      using (auth.uid() = user_id);
  end if;
end;
$$;

commit;
