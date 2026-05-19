-- ═══════════════════════════════════════════════════════════════════
--  PRICERADAR AI · ESQUEMA DO BANCO DE DADOS REMOTO (Supabase / Postgres)
--  Cole TODO este arquivo no Supabase: Dashboard -> SQL Editor -> Run
-- ═══════════════════════════════════════════════════════════════════

-- ─── PERFIL DO USUÁRIO (ligado ao Supabase Auth) ───
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text,
  created_at  timestamptz default now()
);

-- Cria o perfil automaticamente quando alguém se cadastra
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── WATCHLIST (produtos monitorados por usuário) ───
create table if not exists public.watchlist (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  product_key   text not null,
  title         text not null,
  store         text not null,
  url           text not null,
  current_price numeric,
  target_price  numeric,
  category      text default '',
  notify_email  boolean default true,
  created_at    timestamptz default now(),
  unique (user_id, product_key)
);

-- ─── HISTÓRICO DE PREÇOS ───
create table if not exists public.price_history (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  product_key text not null,
  price       numeric not null,
  store       text not null,
  seen_at     timestamptz default now()
);
create index if not exists idx_history_product
  on public.price_history (user_id, product_key, seen_at);

-- ─── LOG DE BUSCAS ───
create table if not exists public.scan_log (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  query      text not null,
  store      text not null,
  status     text not null,
  count      integer default 0,
  elapsed_ms integer default 0,
  run_at     timestamptz default now()
);

-- ═══════════════════════════════════════════════════════════════════
--  RLS — cada usuário só enxerga os próprios dados
-- ═══════════════════════════════════════════════════════════════════
alter table public.profiles      enable row level security;
alter table public.watchlist     enable row level security;
alter table public.price_history enable row level security;
alter table public.scan_log      enable row level security;

create policy "perfil proprio"        on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "watchlist propria"     on public.watchlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "historico proprio"     on public.price_history
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "scanlog proprio"       on public.scan_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
