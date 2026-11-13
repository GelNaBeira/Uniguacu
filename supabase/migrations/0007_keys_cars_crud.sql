-- Marco 4. Pré-requisito: 0001–0006 instaladas/homologadas.
-- Executar INTEIRO, incluindo os blocos DO, de BEGIN até COMMIT.
-- Não executar reset 0006a nem reaplicar baseline. Não modifica empréstimos.
begin;

do $$
declare t text;
begin
  foreach t in array array['keys','car_keys'] loop
    if to_regclass(format('public.%I',t)) is null then
      raise exception 'Tabela % ausente; conferir migrations anteriores.', t;
    end if;
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname <> t || '_select') then
      raise exception 'Políticas adicionais em %; reconciliar antes de aplicar 0007.', t;
    end if;
  end loop;
  if to_regprocedure('public.admin_update_car_registration(uuid,text,integer)') is not null then
    raise exception 'RPC admin_update_car_registration já existe; revisar antes de aplicar 0007.';
  end if;
end; $$;

alter table public.keys add constraint keys_name_not_blank check (length(btrim(name)) > 0) not valid;
alter table public.car_keys add constraint car_keys_name_not_blank check (length(btrim(name)) > 0) not valid;
alter table public.car_keys add constraint car_keys_mileage_nonnegative check (mileage is null or mileage >= 0) not valid;
-- Reafirma defaults; não modifica status/quilometragem dos registros existentes.
alter table public.keys alter column status set default 'DISPONIVEL';
alter table public.car_keys alter column status set default 'DISPONIVEL';
create index keys_name_idx on public.keys(name);
create index keys_status_name_idx on public.keys(status,name);
create index car_keys_name_idx on public.car_keys(name);
create index car_keys_status_name_idx on public.car_keys(status,name);

do $$
declare t text; columns text; flag text;
begin
  foreach t in array array['keys','car_keys'] loop
    flag := case t when 'keys' then 'can_manage_keys' else 'can_manage_cars' end;
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', t);
    select string_agg(quote_ident(attname), ', ') into columns from pg_attribute
      where attrelid = format('public.%I', t)::regclass and attnum > 0 and not attisdropped;
    execute format('revoke all privileges (%s) on table public.%I from public, anon, authenticated', columns, t);
    execute format('grant select, delete on table public.%I to authenticated', t);
    columns := case t when 'keys' then 'name' else 'name, mileage' end;
    execute format('grant insert (%s) on table public.%I to authenticated', columns, t);
    -- Nenhum cliente recebe UPDATE status/mileage/id, inclusive ADMIN via REST.
    execute format('grant update (name) on table public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_admin() or private.has_permission(''can_read_inventory''))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (status = ''DISPONIVEL'' and (private.is_admin() or (private.has_permission(''can_read_inventory'') and private.has_permission(%L))))', t || '_insert', t, flag);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_admin() or (private.has_permission(''can_read_inventory'') and private.has_permission(%L))) with check (private.is_admin() or (private.has_permission(''can_read_inventory'') and private.has_permission(%L)))', t || '_update', t, flag, flag);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_admin() or (private.has_permission(''can_read_inventory'') and private.has_permission(%L) and private.has_permission(''can_delete'')))', t || '_delete', t, flag);
  end loop;
end; $$;

-- Única correção de quilometragem desta entrega: gate atual no banco, não role do JWT.
-- Atualiza nome+quilometragem atomicamente, sem aceitar status nem SQL dinâmico.
create function public.admin_update_car_registration(p_id uuid, p_name text, p_mileage integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare updated_id uuid;
begin
  if (select auth.uid()) is null or not private.is_admin() then
    raise exception 'Apenas ADMIN ativo pode corrigir quilometragem.' using errcode = '42501';
  end if;
  if p_id is null or p_name is null or length(btrim(p_name)) = 0
    or (p_mileage is not null and p_mileage < 0) then
    raise exception 'Dados de cadastro inválidos.' using errcode = '23514';
  end if;
  update public.car_keys set name = btrim(p_name), mileage = p_mileage
    where id = p_id returning id into updated_id;
  return updated_id;
end; $$;
alter function public.admin_update_car_registration(uuid,text,integer) owner to postgres;
revoke all on function public.admin_update_car_registration(uuid,text,integer) from public, anon, authenticated;
grant execute on function public.admin_update_car_registration(uuid,text,integer) to authenticated;

-- Pós-condições: 8 policies, grants protegidos e RPC corretamente restrita.
do $$
declare t text; operation text;
begin
  foreach t in array array['keys','car_keys'] loop
    foreach operation in array array['select','insert','update','delete'] loop
      if not exists (
        select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = t
          and p.policyname = t || '_' || operation and p.cmd = upper(operation)
          and p.permissive = 'PERMISSIVE' and p.roles = array['authenticated']::name[]
          and (operation not in ('select','update','delete') or p.qual is not null)
          and (operation not in ('insert','update') or p.with_check is not null)
      ) then raise exception '0007 incompleta: policy %_% ausente ou incompatível.', t, operation; end if;
    end loop;
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = t) <> 4 then
      raise exception '0007: quantidade inesperada de policies em %.', t;
    end if;
    if not (select relrowsecurity from pg_class where oid = format('public.%I',t)::regclass)
      or not has_table_privilege('authenticated', format('public.%I',t), 'SELECT')
      or not has_table_privilege('authenticated', format('public.%I',t), 'DELETE')
      or not has_column_privilege('authenticated', format('public.%I',t), 'name', 'INSERT')
      or not has_column_privilege('authenticated', format('public.%I',t), 'name', 'UPDATE')
      or has_column_privilege('authenticated', format('public.%I',t), 'status', 'INSERT')
      or has_column_privilege('authenticated', format('public.%I',t), 'status', 'UPDATE')
      or has_column_privilege('authenticated', format('public.%I',t), 'id', 'INSERT')
      or has_column_privilege('authenticated', format('public.%I',t), 'id', 'UPDATE') then
      raise exception '0007: grants/RLS incorretos em %.', t;
    end if;
  end loop;
  if has_column_privilege('authenticated','public.car_keys','mileage','UPDATE')
    or not has_column_privilege('authenticated','public.car_keys','mileage','INSERT') then
    raise exception '0007: grants de mileage incorretos.';
  end if;
  if has_function_privilege('anon','public.admin_update_car_registration(uuid,text,integer)','EXECUTE')
    or not has_function_privilege('authenticated','public.admin_update_car_registration(uuid,text,integer)','EXECUTE') then
    raise exception '0007: grants da RPC incorretos.';
  end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'admin_update_car_registration'
      and p.oid = 'public.admin_update_car_registration(uuid,text,integer)'::regprocedure
      and p.prosecdef and pg_get_userbyid(p.proowner) = 'postgres'
      and p.proconfig = array['search_path=""']) then
    raise exception '0007: configuração SECURITY DEFINER/search_path/owner da RPC incorreta.';
  end if;
end; $$;

-- FKs e UUIDs preservados; sem saneamento, geração distance ou movimentações.
commit;