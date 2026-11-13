\set ON_ERROR_STOP on
-- SOMENTE banco Supabase isolado, como postgres, após 0001–0007.
-- Fixtures fictícias e rollback. Não executar em produção.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('50000000-0000-4000-8000-000000000001','m4-user@example.invalid','{}'),
 ('50000000-0000-4000-8000-000000000002','m4-admin@example.invalid','{}');
update public.usuarios set role = 'ADMIN' where id = '50000000-0000-4000-8000-000000000002';
insert into public.keys(id,name) values ('50000000-0000-4000-8000-000000000003','M4 vinculada');
insert into public.car_keys(id,name,mileage) values ('50000000-0000-4000-8000-000000000004','M4 vinculado',100);
insert into public.key_lends(key_id,out_date) values ('50000000-0000-4000-8000-000000000003',current_date);
insert into public.car_key_lends(car_key_id,out_date,km_out) values ('50000000-0000-4000-8000-000000000004',current_date,100);

set local role authenticated;
select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000001',true);
do $$
declare t text; rid uuid; affected integer;
begin
  foreach t in array array['keys','car_keys'] loop
    execute format('insert into public.%I(name) values (''M4 removível'') returning id',t) into rid;
    if t = 'keys' then
      if (select status from public.keys where id = rid) <> 'DISPONIVEL' then raise exception 'Status inicial chave incorreto'; end if;
    else
      if (select status from public.car_keys where id = rid) <> 'DISPONIVEL' then raise exception 'Status inicial carro incorreto'; end if;
    end if;
    execute format('update public.%I set name = ''M4 editado'' where id = $1',t) using rid;
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'USER não editou %',t; end if;
    begin
      execute format('update public.%I set status = ''INDISPONIVEL'' where id = $1',t) using rid;
      raise exception 'UPDATE status permitido em %',t;
    exception when insufficient_privilege then null; end;
    begin
      execute format('insert into public.%I(name,status) values (''M4 forjado'',''INDISPONIVEL'')',t);
      raise exception 'INSERT status permitido em %',t;
    exception when insufficient_privilege then null; end;
    begin
      execute format('update public.%I set id = gen_random_uuid() where id = $1',t) using rid;
      raise exception 'UPDATE id permitido em %',t;
    exception when insufficient_privilege then null; end;
    begin
      execute format('insert into public.%I(name) values (''   '')',t);
      raise exception 'Nome vazio aceito em %',t;
    exception when check_violation then null; end;
    execute format('delete from public.%I where id = $1',t) using rid;
    get diagnostics affected = row_count;
    if affected <> 0 then raise exception 'USER sem can_delete excluiu %',t; end if;
  end loop;
  insert into public.car_keys(name,mileage) values ('M4 inicial',500);
  insert into public.car_keys(name,mileage) values ('M4 nulo',null);
  begin
    insert into public.car_keys(name,mileage) values ('M4 negativo',-1);
    raise exception 'Mileage negativo aceito';
  exception when check_violation then null; end;
  begin
    update public.car_keys set mileage = 999 where name = 'M4 inicial';
    raise exception 'USER atualizou mileage diretamente';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_update_car_registration('50000000-0000-4000-8000-000000000004','M4 ataque',999);
    raise exception 'USER chamou RPC ADMIN';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;

update public.usuarios set limited_access = jsonb_set(limited_access,'{can_delete}','true') where id = '50000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
declare t text; affected integer;
begin
  foreach t in array array['keys','car_keys'] loop
    execute format('delete from public.%I where name = ''M4 editado''',t);
    get diagnostics affected = row_count;
    if affected <> 1 then raise exception 'USER com can_delete não excluiu %',t; end if;
    begin
      execute format('delete from public.%I where id = $1',t)
        using case when t = 'keys' then '50000000-0000-4000-8000-000000000003'::uuid else '50000000-0000-4000-8000-000000000004'::uuid end;
      raise exception 'FK não protegeu %',t;
    exception when foreign_key_violation then null; end;
  end loop;
end; $$;
reset role;

-- Flags independentes e revogação sem trocar JWT.
update public.usuarios set limited_access = '{"version":1,"can_read_inventory":true,"can_manage_keys":true}' where id = '50000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  insert into public.keys(name) values ('M4 só chave');
  begin
    insert into public.car_keys(name,mileage) values ('M4 carro negado',0);
    raise exception 'Sem can_manage_cars criou carro';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;

select set_config('request.jwt.claim.sub','50000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare rid uuid;
begin
  rid := public.admin_update_car_registration('50000000-0000-4000-8000-000000000004','M4 corrigido',200);
  if rid is null or (select mileage from public.car_keys where id = rid) <> 200 then raise exception 'ADMIN não corrigiu mileage'; end if;
  if (select status from public.car_keys where id = rid) <> 'DISPONIVEL' then raise exception 'RPC alterou status'; end if;
  if public.admin_update_car_registration('50000000-0000-4000-8000-000000000099','Ausente',0) is not null then raise exception 'RPC achou carro ausente'; end if;
  begin
    perform public.admin_update_car_registration(rid,'Negativo',-1);
    raise exception 'RPC aceitou negativo';
  exception when check_violation then null; end;
  begin
    update public.car_keys set mileage = 300 where id = rid;
    raise exception 'ADMIN atualizou mileage sem RPC';
  exception when insufficient_privilege then null; end;
  begin
    update public.car_keys set status = 'INDISPONIVEL' where id = rid;
    raise exception 'ADMIN atualizou status';
  exception when insufficient_privilege then null; end;
  insert into public.keys(name) values ('M4 ADMIN');
  delete from public.keys where name = 'M4 ADMIN';
end; $$;
reset role;
update public.usuarios set is_active = false where id = '50000000-0000-4000-8000-000000000002';
set local role authenticated;
do $$ begin
  begin
    perform public.admin_update_car_registration('50000000-0000-4000-8000-000000000004','Inativo',200);
    raise exception 'ADMIN inativo chamou RPC';
  exception when insufficient_privilege then null; end;
  if exists (select 1 from public.keys) or exists (select 1 from public.car_keys) then raise exception 'Inativo lê cadastros'; end if;
end; $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform public.admin_update_car_registration('50000000-0000-4000-8000-000000000004','Anon',0);
    raise exception 'anon chamou RPC';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;