-- Marco 2 / template categories. Aplicar só após revisão em ambiente isolado.
begin;

-- Não ampliar acesso silenciosamente se o catálogo remoto divergir do Marco 1.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'categories'
    and policyname <> 'categories_select') then
    raise exception 'Políticas adicionais em categories; reconciliar antes de aplicar 0004.';
  end if;
end;
$$;

-- Sem saneamento implícito de nomes legados: NOT VALID protege escritas novas.
alter table public.categories add constraint categories_name_not_blank
  check (length(btrim(name)) > 0) not valid;

alter table public.categories enable row level security;
revoke all privileges on table public.categories from public, anon, authenticated;
revoke all privileges (id, name) on table public.categories from public, anon, authenticated;
grant select, delete on table public.categories to authenticated;
grant insert (name), update (name) on table public.categories to authenticated;

-- Reafirmar a leitura conhecida sem depender de política permissiva desconhecida.
drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories for select to authenticated
using (private.is_admin() or private.has_permission('can_read_inventory'));

create policy categories_insert on public.categories for insert to authenticated
with check (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_catalogs')));

create policy categories_update on public.categories for update to authenticated
using (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_catalogs')))
with check (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_catalogs')));

create policy categories_delete on public.categories for delete to authenticated
using (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_manage_catalogs') and private.has_permission('can_delete')));

-- UNIQUE(name) e products.category_id NO ACTION da baseline são preservados.
-- Sem grants adicionais para as outras entidades e sem acesso via service role.
commit;