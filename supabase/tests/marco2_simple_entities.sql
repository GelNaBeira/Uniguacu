\set ON_ERROR_STOP on
-- APENAS em Supabase isolado, como postgres, após 0001–0005. Não executar em produção.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('30000000-0000-4000-8000-000000000001','m2-simple-user@example.invalid','{}'),
 ('30000000-0000-4000-8000-000000000002','m2-simple-admin@example.invalid','{}');
update public.usuarios set role = 'ADMIN' where id = '30000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000001',true);
do $$
declare t text; col text; affected integer;
begin
  foreach t in array array['sectors','suppliers','collaborators','academics'] loop
    col := case when t = 'suppliers' then 'fantasy_name' else 'name' end;
    execute format('insert into public.%I (%I) values (''M2 fixture'')', t, col);
    execute format('update public.%I set %I = ''M2 editada'' where %I = ''M2 fixture''', t, col, col);
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'USER não editou %', t; end if;
    execute format('delete from public.%I where %I = ''M2 editada''', t, col);
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'USER sem can_delete excluiu %', t; end if;
    begin
      execute format('insert into public.%I (%I) values (''   '')', t, col);
      raise exception 'Nome vazio aceito em %', t;
    exception when check_violation then null; end;
    begin
      execute format('update public.%I set id = ''30000000-0000-4000-8000-000000000099'' where %I = ''M2 editada''', t, col);
      raise exception 'ID protegido alterado em %', t;
    exception when insufficient_privilege then null; end;
  end loop;
  begin
    insert into public.sectors(name) values ('M2 editada');
    raise exception 'Duplicidade de setor permitida';
  exception when unique_violation then null; end;
  begin
    insert into public.suppliers(fantasy_name,cnpj_cpf) values ('M2 documento inválido','123');
    raise exception 'Documento inválido aceito';
  exception when check_violation then null; end;
  insert into public.suppliers(fantasy_name,cnpj_cpf) values ('M2 alfa','12.ABC.345/01DE-00');
  begin
    update public.suppliers set created_at = now() where fantasy_name = 'M2 alfa';
    raise exception 'created_at alterável';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;

-- Fixtures para garantir preservação de vínculos reais nas exclusões.
insert into public.products(name,sector_id,supplier_id)
select 'M2 produto', s.id, p.id from public.sectors s cross join public.suppliers p
where s.name = 'M2 editada' and p.fantasy_name = 'M2 editada';
insert into public.keys(id,name) values ('30000000-0000-4000-8000-000000000003','M2 chave');
insert into public.key_lends(key_id,collaborator_id,out_date)
select '30000000-0000-4000-8000-000000000003', id, current_date from public.collaborators where name = 'M2 editada';
update public.usuarios set limited_access = jsonb_set(limited_access,'{can_delete}','true')
where id = '30000000-0000-4000-8000-000000000001';

set local role authenticated;
do $$
declare t text; col text; affected integer;
begin
  foreach t in array array['sectors','suppliers','collaborators','academics'] loop
    col := case when t = 'suppliers' then 'fantasy_name' else 'name' end;
    execute format('insert into public.%I (%I) values (''M2 removível'')', t, col);
    execute format('delete from public.%I where %I = ''M2 removível''', t, col);
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'USER com flag não excluiu %', t; end if;
    if t <> 'academics' then
      begin
        execute format('delete from public.%I where %I = ''M2 editada''', t, col);
        raise exception 'Registro referenciado excluído de %', t;
      exception when foreign_key_violation then null; end;
    end if;
  end loop;
end; $$;
reset role;
update public.usuarios set limited_access = '{"version":1,"can_read_inventory":true,"can_delete":true}'
where id = '30000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
declare t text; col text;
begin
  foreach t in array array['sectors','suppliers','collaborators','academics'] loop
    col := case when t = 'suppliers' then 'fantasy_name' else 'name' end;
    begin
      execute format('insert into public.%I (%I) values (''M2 negado'')', t, col);
      raise exception 'Sem can_manage_catalogs criou em %', t;
    exception when insufficient_privilege then null; end;
  end loop;
end; $$;
select set_config('request.jwt.claim.sub','30000000-0000-4000-8000-000000000002',true);
do $$
declare t text; col text; affected integer;
begin
  foreach t in array array['sectors','suppliers','collaborators','academics'] loop
    col := case when t = 'suppliers' then 'fantasy_name' else 'name' end;
    execute format('insert into public.%I (%I) values (''M2 admin'')', t, col);
    execute format('delete from public.%I where %I = ''M2 admin''', t, col);
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'ADMIN não excluiu %', t; end if;
  end loop;
end; $$;
reset role;
set local role anon;
do $$
declare t text;
begin
  foreach t in array array['sectors','suppliers','collaborators','academics'] loop
    begin
      execute format('select id from public.%I limit 1', t);
      raise exception 'anon acessou %', t;
    exception when insufficient_privilege then null; end;
  end loop;
end; $$;
reset role;
rollback;