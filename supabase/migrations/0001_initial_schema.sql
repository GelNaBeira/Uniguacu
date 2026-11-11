-- Extensões
create extension if not exists "uuid-ossp";

-- Enums
create type user_role as enum ('ADMIN', 'USER');
create type item_status as enum ('DISPONIVEL', 'INDISPONIVEL');
create type lend_status as enum ('EM_ANDAMENTO', 'ATRASADO', 'DEVOLVIDO', 'SEM_DEVOLUCAO');

-- Usuarios (perfil, referencia auth.users)
create table public.usuarios (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  name text not null,
  role user_role not null default 'USER',
  limited_access jsonb default '{}'::jsonb,
  photo_url text,
  created_at timestamptz default now()
);

-- Entidades de apoio
create table public.categories (id uuid primary key default uuid_generate_v4(), name text unique not null);
create table public.sectors (id uuid primary key default uuid_generate_v4(), name text unique not null);
create table public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  fantasy_name text not null,
  legal_name text,
  cnpj_cpf text,
  created_at timestamptz default now()
);

-- Pessoas
create table public.collaborators (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  identification text,
  role_function text,
  phone text
);
create table public.academics (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  ra text,
  course text
);

-- Produtos
create table public.products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  qtd integer not null default 0 check (qtd >= 0),
  price numeric(12,2),
  bar_code text,
  note_id text,
  description text,
  has_barcode boolean default false,
  category_id uuid references public.categories(id),
  sector_id uuid references public.sectors(id),
  supplier_id uuid references public.suppliers(id),
  created_at timestamptz default now()
);

-- Chaves e carros
create table public.keys (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  status item_status not null default 'DISPONIVEL'
);
create table public.car_keys (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  mileage integer default 0,
  status item_status not null default 'DISPONIVEL'
);

-- Empréstimos
create table public.lendies (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references public.products(id),
  collaborator_id uuid references public.collaborators(id),
  quantity integer not null check (quantity > 0),
  out_date date not null,
  out_time time,
  return_date date,
  return_time time,
  no_return boolean default false,
  out_observation text,
  return_observation text,
  status lend_status default 'EM_ANDAMENTO',
  created_at timestamptz default now()
);
create table public.key_lends (
  id uuid primary key default uuid_generate_v4(),
  key_id uuid not null references public.keys(id),
  collaborator_id uuid references public.collaborators(id),
  out_date date not null,
  return_date date,
  status lend_status default 'EM_ANDAMENTO',
  created_at timestamptz default now()
);
create table public.car_key_lends (
  id uuid primary key default uuid_generate_v4(),
  car_key_id uuid not null references public.car_keys(id),
  collaborator_id uuid references public.collaborators(id),
  out_date date not null,
  return_date date,
  km_out integer,
  km_in integer,
  distance integer generated always as (coalesce(km_in,0) - coalesce(km_out,0)) stored,
  status lend_status default 'EM_ANDAMENTO',
  created_at timestamptz default now()
);

-- Histórico de operações
create table public.operations (
  id uuid primary key default uuid_generate_v4(),
  operation_type text not null,
  description text,
  user_id uuid references public.usuarios(id),
  created_at timestamptz default now()
);

-- RLS: habilitar em TODAS as tabelas
alter table public.usuarios enable row level security;
alter table public.categories enable row level security;
alter table public.sectors enable row level security;
alter table public.suppliers enable row level security;
alter table public.collaborators enable row level security;
alter table public.academics enable row level security;
alter table public.products enable row level security;
alter table public.keys enable row level security;
alter table public.car_keys enable row level security;
alter table public.lendies enable row level security;
alter table public.key_lends enable row level security;
alter table public.car_key_lends enable row level security;
alter table public.operations enable row level security;

-- Exemplo de políticas (o Cline vai refinar na Fase 1)
-- Qualquer usuário autenticado lê; só ADMIN escreve em usuários
create policy "usuarios_select_auth" on public.usuarios for select to authenticated using (true);
create policy "usuarios_admin_all" on public.usuarios for all to authenticated
  using (exists (select 1 from public.usuarios u where u.id = auth.uid() and u.role = 'ADMIN'));

-- Produtos: leitura para autenticados; escrita para ADMIN ou USER com permissão
create policy "products_select_auth" on public.products for select to authenticated using (true);
create policy "products_write_auth" on public.products for insert to authenticated with check (true);
create policy "products_update_auth" on public.products for update to authenticated using (true);

-- (demais políticas a definir na Fase 1)