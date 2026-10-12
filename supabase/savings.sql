create table public.savings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric not null check (amount > 0 and amount < 'Infinity'::numeric),
  currency text not null default 'INR' check (currency ~ '^[A-Z]{3}$'),
  description text not null default 'Savings deposit' check (length(btrim(description)) > 0),
  savings_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index savings_user_date_idx
  on public.savings (user_id, savings_date desc);

alter table public.savings enable row level security;

grant select, insert, update, delete on public.savings to authenticated;

create policy "Users can view their own savings"
  on public.savings
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can insert their own savings"
  on public.savings
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own savings"
  on public.savings
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own savings"
  on public.savings
  for delete
  to authenticated
  using (auth.uid() = user_id);
