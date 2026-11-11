-- Marco 3. Pré-requisito: 0001–0005 instaladas; aplicar SOMENTE esta migration.
-- Aprovação mais recente: qtd pode ser definida no INSERT, nunca UPDATE do cliente.
begin;

do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'products' and policyname <> 'products_select') then
    raise exception 'Políticas adicionais em products; reconciliar antes de aplicar 0006.';
  end if;
  -- Policies permissivas se combinam por OR: não ignorar políticas desconhecidas,
  -- mesmo quando nomeadas para outros buckets (podem ter predicados globais).
  if exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects') then
    raise exception 'Políticas Storage existentes; revisar escopo antes de aplicar 0006. Não apagar políticas automaticamente.';
  end if;
end; $$;

-- Compatível com o reset manual 0006a, que já recria a estrutura final.
-- Não usar este IF NOT EXISTS para aceitar schema remoto arbitrário sem revisão.
alter table public.products add column if not exists image_path text;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'products_name_not_blank') then
    alter table public.products add constraint products_name_not_blank check (length(btrim(name)) > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'products_price_nonnegative') then
    alter table public.products add constraint products_price_nonnegative check (price is null or (price >= 0 and price <> 'NaN'::numeric)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'products_has_barcode_not_null') then
    alter table public.products add constraint products_has_barcode_not_null check (has_barcode is not null) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'products_image_path_format') then
    alter table public.products add constraint products_image_path_format check (
      image_path is null or image_path ~ ('^' || id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$')
    ) not valid;
  end if;
end; $$;
create index if not exists products_name_idx on public.products(name);
create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists products_sector_id_idx on public.products(sector_id);
create index if not exists products_supplier_id_idx on public.products(supplier_id);

alter table public.products enable row level security;
revoke all privileges on table public.products from public, anon, authenticated;
do $$
declare columns text;
begin
  select string_agg(quote_ident(attname), ', ') into columns from pg_attribute
    where attrelid = 'public.products'::regclass and attnum > 0 and not attisdropped;
  execute format('revoke all privileges (%s) on table public.products from public, anon, authenticated', columns);
end; $$;
grant select, delete on table public.products to authenticated;
grant insert (name,qtd,price,bar_code,note_id,description,has_barcode,category_id,sector_id,supplier_id) on public.products to authenticated;
grant update (name,price,bar_code,note_id,description,has_barcode,category_id,sector_id,supplier_id,image_path) on public.products to authenticated;
drop policy if exists products_select on public.products;
create policy products_select on public.products for select to authenticated
using (private.is_admin() or private.has_permission('can_read_inventory'));
create policy products_insert on public.products for insert to authenticated
with check (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_products')));
create policy products_update on public.products for update to authenticated
using (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_products')))
with check (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_products')));
create policy products_delete on public.products for delete to authenticated
using (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_products') and private.has_permission('can_delete')));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('product-images','product-images',false,3145728,array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
do $$
begin
  if not exists (select 1 from storage.buckets where id = 'product-images' and not public and file_size_limit = 3145728
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp']::text[]
    and allowed_mime_types <@ array['image/jpeg','image/png','image/webp']::text[]) then
    raise exception 'Bucket product-images existente incompatível. Revisar privacidade, MIME e limite sem alterar silenciosamente.';
  end if;
end; $$;

-- UUID validado por texto, sem cast vulnerável a caminhos malformados.
create or replace function private.product_image_path_valid(path text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$', false);
$$;
revoke all on function private.product_image_path_valid(text) from public, anon, authenticated;
grant execute on function private.product_image_path_valid(text) to authenticated;

create policy product_images_select on storage.objects for select to authenticated
using (bucket_id = 'product-images' and private.product_image_path_valid(name)
  and (private.is_admin() or private.has_permission('can_read_inventory')));
create policy product_images_insert on storage.objects for insert to authenticated
with check (bucket_id = 'product-images' and private.product_image_path_valid(name)
  and (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_products')))
  and exists (select 1 from public.products p where p.id::text = split_part(storage.objects.name,'/',1)));
-- Arquivos imutáveis: substituição usa UUID novo. Nenhuma policy UPDATE/upsert/move.
create policy product_images_delete on storage.objects for delete to authenticated
using (bucket_id = 'product-images' and private.product_image_path_valid(name)
  and (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_products') and private.has_permission('can_delete')))
  and not exists (select 1 from public.products p where p.image_path = storage.objects.name));

-- Referências só podem apontar para objeto visível já enviado no diretório do produto.
-- Trigger invoker, sem elevação de privilégio ou dependência circular com SELECT Storage.
create or replace function private.check_product_image_reference()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.image_path is distinct from old.image_path and new.image_path is not null then
    if not exists (select 1 from storage.objects o where o.bucket_id = 'product-images' and o.name = new.image_path)
       or not private.product_image_path_valid(new.image_path)
       or split_part(new.image_path,'/',1) <> new.id::text then
      raise exception 'Referência de imagem inválida ou não autorizada.' using errcode = '23514';
    end if;
  end if;
  return new;
end; $$;
revoke all on function private.check_product_image_reference() from public, anon, authenticated;
create trigger products_check_image before update of image_path on public.products
for each row execute function private.check_product_image_reference();

-- Sem backfill, sem UNIQUE de bar_code, sem geração por exemplar, sem RPC de estoque.
-- Não apagar objetos via SQL: remover arquivos exclusivamente pela API Storage.
commit;