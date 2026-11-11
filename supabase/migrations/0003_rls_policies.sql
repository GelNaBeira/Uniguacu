begin;

create function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.is_active and u.role = 'ADMIN');
$$;

create function private.has_permission(flag text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = (select auth.uid()) and u.is_active and u.role = 'USER'
      and flag = any(array['can_read_inventory','can_manage_catalogs','can_manage_products',
        'can_manage_keys','can_manage_cars','can_lend','can_return','can_delete',
        'can_view_reports','can_view_all_lends'])
      and jsonb_typeof(u.limited_access) = 'object'
      and u.limited_access -> 'version' = '1'::jsonb
      and not exists (
        select 1 from jsonb_each(case when jsonb_typeof(u.limited_access) = 'object'
          then u.limited_access else '{}'::jsonb end) entry
        where entry.key <> 'version' and (
          entry.key <> all(array['can_read_inventory','can_manage_catalogs','can_manage_products',
            'can_manage_keys','can_manage_cars','can_lend','can_return','can_delete',
            'can_view_reports','can_view_all_lends']) or jsonb_typeof(entry.value) <> 'boolean')
      )
      and u.limited_access -> flag = 'true'::jsonb
  );
$$;
alter function private.is_admin() owner to postgres;
alter function private.has_permission(text) owner to postgres;
revoke all on function private.is_admin(), private.has_permission(text) from public, anon, authenticated;
grant execute on function private.is_admin(), private.has_permission(text) to authenticated;

drop policy usuarios_select_auth on public.usuarios;
drop policy usuarios_admin_all on public.usuarios;
drop policy products_select_auth on public.products;
drop policy products_write_auth on public.products;
drop policy products_update_auth on public.products;

-- Falha fechada diante de políticas remotas não inventariadas. Não apagá-las.
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = any(array[
    'usuarios','categories','sectors','suppliers','collaborators','academics','products',
    'keys','car_keys','lendies','key_lends','car_key_lends','operations'])) then
    raise exception 'Políticas adicionais encontradas; reconciliar catálogo antes de aplicar.';
  end if;
end;
$$;

-- Marco 1: leitura conforme matriz; mutações de negócio continuam sem grants/policies.
-- Grants por coluna de escrita só serão acrescentados no respectivo marco.
do $$
declare t text;
begin
  foreach t in array array['usuarios','categories','sectors','suppliers','collaborators','academics',
    'products','keys','car_keys','lendies','key_lends','car_key_lends','operations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', t);
    -- Defesa explícita adicional: nenhum grant de escrita por coluna neste marco.
    execute (select format('revoke all privileges (%s) on table public.%I from public, anon, authenticated',
      string_agg(quote_ident(a.attname), ', '), t)
      from pg_attribute a where a.attrelid = format('public.%I', t)::regclass and a.attnum > 0 and not a.attisdropped);
    execute format('grant select on table public.%I to authenticated', t);
  end loop;
end;
$$;

create policy usuarios_select on public.usuarios for select to authenticated
using (private.is_admin() or (id = (select auth.uid()) and is_active));

do $$
declare t text;
begin
  foreach t in array array['categories','sectors','suppliers','collaborators','academics','products','keys','car_keys'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_admin() or private.has_permission(''can_read_inventory''))', t || '_select', t);
  end loop;
  foreach t in array array['lendies','key_lends','car_key_lends'] loop
    execute format('create policy %I on public.%I for select to authenticated using (private.is_admin() or (private.has_permission(''can_read_inventory'') and (created_by = (select auth.uid()) or private.has_permission(''can_view_all_lends''))))', t || '_select', t);
  end loop;
end;
$$;

create policy operations_select on public.operations for select to authenticated
using (private.is_admin() or (private.has_permission('can_read_inventory')
  and user_id = (select auth.uid())
  and operation_type in ('PRODUCT_LEND','PRODUCT_RETURN','KEY_LEND','KEY_RETURN','CAR_LEND','CAR_RETURN')));

commit;