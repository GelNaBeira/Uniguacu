-- RECUPERAÇÃO MANUAL DE DESENVOLVIMENTO. NÃO incluir em deploy/migration runner.
-- DESTRUTIVO: apaga TODOS os produtos. Executar como postgres, somente em DEV.
-- Ordem MANUAL: este arquivo PRIMEIRO, depois 0006_products_crud.sql atualizado.
-- Não apaga arquivos do Storage nem tabelas de empréstimos. Não executar em produção.
begin;

-- CASCADE remove a FK, não os empréstimos. Abortar em vez de deixar órfãos.
lock table public.lendies in access exclusive mode;
lock table public.products in access exclusive mode;
do $$ begin
  if exists (select 1 from public.lendies) then
    raise exception 'Reset abortado: há empréstimos em lendies. Resolver os dados de teste explicitamente antes do reset.';
  end if;
  if exists (select 1 from pg_constraint where confrelid = 'public.products'::regclass
    and contype = 'f' and conrelid <> 'public.lendies'::regclass) then
    raise exception 'Reset abortado: existem FKs adicionais para products não previstas no projeto.';
  end if;
end; $$;

-- Somente policies deste marco; não apagar policies de outros buckets.
drop policy if exists product_images_select on storage.objects;
drop policy if exists product_images_insert on storage.objects;
drop policy if exists product_images_delete on storage.objects;

drop table public.products cascade;

create table public.products (
  id uuid primary key default gen_random_uuid(),
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
  created_at timestamptz default now(),
  image_path text,
  constraint products_name_not_blank check (length(btrim(name)) > 0),
  constraint products_price_nonnegative check (price is null or (price >= 0 and price <> 'NaN'::numeric)),
  constraint products_has_barcode_not_null check (has_barcode is not null),
  constraint products_image_path_format check (
    image_path is null or image_path ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
  )
);
create index products_name_idx on public.products(name);
create index products_category_id_idx on public.products(category_id);
create index products_sector_id_idx on public.products(sector_id);
create index products_supplier_id_idx on public.products(supplier_id);
alter table public.lendies add constraint lendies_product_id_fkey
  foreign key (product_id) references public.products(id);

-- Falha fechada entre reset e aplicação da 0006: nenhum acesso direto aberto.
alter table public.products enable row level security;
revoke all privileges on table public.products from public, anon, authenticated;
revoke all privileges (id,name,qtd,price,bar_code,note_id,description,has_barcode,
  category_id,sector_id,supplier_id,created_at,image_path)
  on table public.products from public, anon, authenticated;

-- Funções privadas eventualmente criadas pela tentativa parcial são substituídas
-- pela 0006 atualizada. Não usar DROP FUNCTION CASCADE para esconder dependências.
-- Storage permanece privado/configurado; arquivos antigos podem ficar órfãos.
commit;