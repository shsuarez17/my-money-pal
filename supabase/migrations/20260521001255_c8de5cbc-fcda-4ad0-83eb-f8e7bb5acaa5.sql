-- enums
create type public.asset_type as enum ('STOCK_US','STOCK_CO','ETF','CRYPTO','BOND','OTHER');
create type public.tx_type as enum ('BUY','SELL','DEPOSIT','DIVIDEND');
create type public.recur_freq as enum ('WEEKLY','BIWEEKLY','MONTHLY');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  language text not null default 'es',
  base_currency text not null default 'USD',
  custom_asset_types text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile select" on public.profiles for select using (auth.uid() = id);
create policy "own profile insert" on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id);

-- investments
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_type public.asset_type not null,
  ticker text not null,
  name text not null,
  platform text,
  quantity numeric(28,10) not null default 0,
  avg_cost_usd numeric(20,6) not null default 0,
  current_price_usd numeric(20,6) not null default 0,
  price_updated_at timestamptz,
  notes text,
  currency text not null default 'USD',
  purchase_date date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.investments enable row level security;
create policy "own inv all" on public.investments for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.investments(user_id);

-- transactions
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid references public.investments(id) on delete set null,
  tx_type public.tx_type not null,
  quantity numeric(28,10) not null default 0,
  price_usd numeric(20,6) not null default 0,
  amount_usd numeric(20,6) not null default 0,
  fx_usd_cop numeric(20,6),
  occurred_at timestamptz not null default now(),
  note text,
  created_at timestamptz not null default now()
);
alter table public.transactions enable row level security;
create policy "own tx all" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.transactions(user_id, occurred_at desc);

-- goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  target_amount_usd numeric(20,2) not null,
  target_date date,
  start_date date,
  currency text not null default 'USD',
  color text,
  created_at timestamptz not null default now()
);
alter table public.goals enable row level security;
create policy "own goal all" on public.goals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- recurring contributions
create table public.recurring_contributions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  investment_id uuid references public.investments(id) on delete set null,
  amount_usd numeric(20,2) not null,
  frequency public.recur_freq not null,
  next_run date not null,
  active boolean not null default true,
  currency text not null default 'USD',
  created_at timestamptz not null default now()
);
alter table public.recurring_contributions enable row level security;
create policy "own rec all" on public.recurring_contributions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- portfolio snapshots
create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  snapshot_date date not null,
  total_usd numeric(20,2) not null,
  total_cop numeric(20,2) not null,
  invested_usd numeric(20,2) not null,
  created_at timestamptz not null default now(),
  unique (user_id, snapshot_date)
);
alter table public.portfolio_snapshots enable row level security;
create policy "own snap all" on public.portfolio_snapshots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- fx rates
create table public.fx_rates (
  pair text primary key,
  rate numeric(20,6) not null,
  updated_at timestamptz not null default now()
);
alter table public.fx_rates enable row level security;
create policy "fx read all" on public.fx_rates for select using (true);

-- triggers / functions
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)));
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end; $$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger investments_touch before update on public.investments for each row execute function public.touch_updated_at();

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.touch_updated_at() from public, anon, authenticated;