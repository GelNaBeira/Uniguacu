\set ON_ERROR_STOP on
-- NÃO aplicar M2. Somente em ambiente vazio já migrado e autorizado no futuro.
-- Fixtures sintéticas não são logins Auth; não há DELETE/TRUNCATE nem COMMIT.
begin;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
\ir phase2_m2_readonly_checks.sql
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),('00000000-0000-4000-8000-000000000004');
select uniguacu_private.bootstrap_first_admin('00000000-0000-4000-8000-000000000001','Fixture M2 transacional');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select public.set_operator_access('00000000-0000-4000-8000-000000000002','user',true,'Operador M2 fictício');
select public.set_operator_access('00000000-0000-4000-8000-000000000003','user',false,'Operador M2 inativo');
reset role;
set local role uniguacu_owner;
create temporary table m2_test_marker(id integer) on commit drop;
-- Só o snapshot/assert usa definer. A instrução sob teste sempre é SECURITY INVOKER.
create function pg_temp.m2_state() returns jsonb language sql security definer set search_path = '' as $$
  select jsonb_build_object(
    'operators',(select coalesce(jsonb_agg(to_jsonb(o) order by user_id),'[]') from public.operator_access o),
    'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.administrative_audit a),
    'control',(select to_jsonb(c) from uniguacu_private.access_control c),
    'collaborators',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.collaborators c),
    'catalog',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.catalog_items c));
$$;
create function pg_temp.m2_denied(p_sql text,p_state text,p_rows bigint default null)
returns void language plpgsql security invoker set search_path = '' as $$
declare previous jsonb; caught boolean := false; observed text; affected bigint;
begin
  previous := pg_temp.m2_state();
  begin
    execute p_sql;
    get diagnostics affected = row_count;
  exception when others then
    get stacked diagnostics observed = returned_sqlstate;
    if p_state is null or observed <> p_state then
      raise exception 'SQLSTATE inesperado: % (esperado %)',observed,p_state;
    end if;
    caught := true;
  end;
  if (p_state is not null and not caught)
    or (p_state is null and (caught or affected is distinct from p_rows)) then
    raise exception 'Negativa/quantidade de linhas inesperada';
  end if;
  if pg_temp.m2_state() is distinct from previous then
    raise exception 'Operação negada deixou efeitos em registros/auditoria/controle M1';
  end if;
end $$;
create function pg_temp.m2_assert_registry(p_table text,p_name text,p_active boolean,p_events integer)
returns void language plpgsql security definer set search_path = '' as $$
declare row_data jsonb; col text; total integer; inserts integer; updates integer;
  expected_inactive integer;
begin
  if p_table not in ('collaborators','catalog_items') then raise exception 'Tabela não autorizada'; end if;
  col := case when p_table='collaborators' then 'display_name' else 'name' end;
  execute format('select to_jsonb(t) from public.%I t',p_table) into strict row_data;
  if row_data->>col <> p_name or (row_data->>'active')::boolean <> p_active
    or (row_data->>'created_at')::timestamptz <> transaction_timestamp()
    or (row_data->>'updated_at')::timestamptz <> transaction_timestamp() then
    raise exception 'Valores/defaults/timestamps incorretos em %',p_table;
  end if;
  select count(*), count(*) filter(where action=p_table||'.insert'),
    count(*) filter(where action=p_table||'.update') into total,inserts,updates
    from public.administrative_audit where origin='registry_change' and entity_id=(row_data->>'id')::uuid;
  expected_inactive := case when p_name='Default inativo' then 1
    when p_events=5 then 2 when p_events>=3 then 1 else 0 end;
  if total <> p_events or inserts <> 1 or updates <> p_events-1
    or (select count(*) from public.administrative_audit
      where entity_id=(row_data->>'id')::uuid and origin='registry_change'
        and detail='{"active":false}'::jsonb) <> expected_inactive
    or exists(select 1 from public.administrative_audit
      where origin='registry_change' and entity_id=(row_data->>'id')::uuid
        and (actor_user_id is distinct from '00000000-0000-4000-8000-000000000001'::uuid
          or occurred_at <> transaction_timestamp()
          or action not in (p_table||'.insert',p_table||'.update')
          or detail not in ('{"active":true}'::jsonb,'{"active":false}'::jsonb)))
    or not exists(select 1 from public.administrative_audit
      where origin='registry_change' and entity_id=(row_data->>'id')::uuid
        and action=p_table||case when p_events=1 then '.insert' else '.update' end
        and detail=jsonb_build_object('active',p_active)) then
    raise exception 'Auditoria incorreta (ator/origem/ação/entidade/detalhe/data/quantidade) em %',p_table;
  end if;
end $$;
revoke all on function pg_temp.m2_state() from public;
revoke all on function pg_temp.m2_denied(text,text,bigint) from public;
revoke all on function pg_temp.m2_assert_registry(text,text,boolean,integer) from public;
grant execute on function pg_temp.m2_state(),pg_temp.m2_denied(text,text,bigint) to authenticated;
grant execute on function pg_temp.m2_assert_registry(text,text,boolean,integer) to authenticated;
reset role;
set local role authenticated;
-- M2_ADMIN: cadastro, edição, desativação e reativação em ambas as entidades.
savepoint m2_defaults;
insert into public.collaborators(display_name) values('Default inativo');
insert into public.catalog_items(name,nature) values('Default inativo','consumable');
select pg_temp.m2_assert_registry('collaborators','Default inativo',false,1);
select pg_temp.m2_assert_registry('catalog_items','Default inativo',false,1);
rollback to savepoint m2_defaults;
insert into public.collaborators(display_name,active) values('Pessoa M2',true);
insert into public.catalog_items(name,nature,active) values('Material M2','returnable',true);
select pg_temp.m2_assert_registry('collaborators','Pessoa M2',true,1);
select pg_temp.m2_assert_registry('catalog_items','Material M2',true,1);
update public.collaborators set display_name='Pessoa M2 editada';
update public.catalog_items set name='Material M2 editado',nature='consumable';
select pg_temp.m2_assert_registry('collaborators','Pessoa M2 editada',true,2);
select pg_temp.m2_assert_registry('catalog_items','Material M2 editado',true,2);
do $$ begin
  if not exists(select 1 from public.catalog_items where nature='consumable') then
    raise exception 'Natureza não alterada';
  end if;
end $$;
update public.collaborators set active=false;
update public.catalog_items set active=false;
select pg_temp.m2_assert_registry('collaborators','Pessoa M2 editada',false,3);
select pg_temp.m2_assert_registry('catalog_items','Material M2 editado',false,3);
do $$ begin
  if (select count(*) from public.collaborators) <> 1 or (select count(*) from public.catalog_items) <> 1 then
    raise exception 'Admin não visualiza inativos';
  end if;
end $$;
-- M2_IMMUTABLE: admin também não pode fornecer identidade/timestamps na API.
do $$ declare t text; c text; v text; begin
  foreach t in array array['collaborators','catalog_items'] loop
    foreach c in array array['id','created_at','updated_at'] loop
      v := case when c='id' then '''ffffffff-ffff-4fff-8fff-ffffffffffff''' else '''2000-01-01T00:00:00Z''' end;
      perform pg_temp.m2_denied(format('update public.%I set %I=%s',t,c,v),'42501');
      if t='collaborators' then
        perform pg_temp.m2_denied(format('insert into public.%I(display_name,%I) values(''Forjado'',%s)',t,c,v),'42501');
      else
        perform pg_temp.m2_denied(format('insert into public.%I(name,nature,%I) values(''Forjado'',''returnable'',%s)',t,c,v),'42501');
      end if;
    end loop;
    -- Exclusão não é executada: comprovar ausência de ACL sem apagar registros.
    if has_table_privilege(current_user,'public.'||t,'DELETE') then raise exception 'DELETE exposto'; end if;
  end loop;
end $$;
-- M2_INTEGRITY: constraints autorizadas e rollback de auditoria em falhas.
select pg_temp.m2_denied($$insert into public.collaborators(display_name) values('   ')$$,'23514');
select pg_temp.m2_denied($$insert into public.collaborators(display_name) values(repeat('x',161))$$,'23514');
select pg_temp.m2_denied($$insert into public.collaborators(display_name) values(null)$$,'23502');
select pg_temp.m2_denied($$insert into public.catalog_items(name,nature) values('X','invalid')$$,'23514');
select pg_temp.m2_denied($$insert into public.catalog_items(name,nature) values('','returnable')$$,'23514');
select pg_temp.m2_denied($$insert into public.catalog_items(name,nature) values(repeat('x',161),'consumable')$$,'23514');
select pg_temp.m2_denied($$insert into public.catalog_items(name,nature) values(null,'consumable')$$,'23502');
select pg_temp.m2_denied($$update public.catalog_items set nature='invalid'$$,'23514');
select pg_temp.m2_denied($$update public.collaborators set active=null$$,'23502');
select pg_temp.m2_denied($$insert into public.collaborators(display_name) values('Válido'),('')$$,'23514');
select pg_temp.m2_denied($$insert into public.catalog_items(name,nature) values('Válido','returnable'),('Inválido','outro')$$,'23514');
-- M2_RLS: inativos invisíveis; UPDATE negado por RLS retorna zero, não necessariamente erro.
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  if exists(select 1 from public.collaborators) or exists(select 1 from public.catalog_items)
    or exists(select 1 from public.administrative_audit) then raise exception 'Operador visualiza inativos/auditoria'; end if;
end $$;
select pg_temp.m2_denied($$update public.collaborators set active=true$$,null,0);
select pg_temp.m2_denied($$update public.catalog_items set active=true$$,null,0);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
update public.collaborators set active=true;
update public.catalog_items set active=true;
select pg_temp.m2_assert_registry('collaborators','Pessoa M2 editada',true,4);
select pg_temp.m2_assert_registry('catalog_items','Material M2 editado',true,4);
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ begin
  if (select count(*) from public.collaborators) <> 1 or (select count(*) from public.catalog_items) <> 1 then
    raise exception 'Operador não consulta ativos';
  end if;
end $$;
select pg_temp.m2_denied($$insert into public.collaborators(display_name,active) values('Proibido',true)$$,'42501');
select pg_temp.m2_denied($$insert into public.catalog_items(name,nature,active) values('Proibido','returnable',true)$$,'42501');
select pg_temp.m2_denied($$update public.collaborators set display_name='Proibido'$$,null,0);
select pg_temp.m2_denied($$update public.catalog_items set name='Proibido'$$,null,0);
select pg_temp.m2_denied($$select uniguacu_private.require_active_collaborator(null)$$,'42501');
-- M1 preservada: operador não promove a si; admin não remove o último admin ativo.
select pg_temp.m2_denied($$select public.set_operator_access('00000000-0000-4000-8000-000000000002','admin',true,'Elevação negada')$$,'42501');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
select pg_temp.m2_denied($$select public.set_operator_access('00000000-0000-4000-8000-000000000001','user',true,'Rebaixamento negado')$$,'23514');
select pg_temp.m2_denied($$select public.set_operator_access('00000000-0000-4000-8000-000000000001','admin',false,'Desativação negada')$$,'23514');
-- Inativo, não cadastrado e ausência de identidade não consultam registros ativos.
do $$ declare uid text; begin
  foreach uid in array array['00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',''] loop
    perform set_config('request.jwt.claim.sub',uid,true);
    if exists(select 1 from public.collaborators) or exists(select 1 from public.catalog_items) then
      raise exception 'Identidade sem autorização consulta ativos';
    end if;
    perform pg_temp.m2_denied($q$insert into public.collaborators(display_name) values('Negado')$q$,'42501');
    perform pg_temp.m2_denied($q$insert into public.catalog_items(name,nature) values('Negado','consumable')$q$,'42501');
    perform pg_temp.m2_denied($q$update public.collaborators set active=false$q$,null,0);
    perform pg_temp.m2_denied($q$update public.catalog_items set active=false$q$,null,0);
  end loop;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform id from public.collaborators; raise exception 'Anon consulta colaboradores';
  exception when insufficient_privilege then null; end;
  begin perform id from public.catalog_items; raise exception 'Anon consulta catálogo';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
-- M2_RECIPIENT: helper INTERNO; owner técnico não é teste de RLS nem RPC pública.
set local role uniguacu_owner;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ declare recipient uuid; begin
  select id into strict recipient from public.collaborators;
  if uniguacu_private.require_active_collaborator(recipient) <> recipient then raise exception 'Helper alterou identidade'; end if;
  perform pg_temp.m2_denied($q$select uniguacu_private.require_active_collaborator('ffffffff-ffff-4fff-8fff-ffffffffffff')$q$,'23514');
  perform pg_temp.m2_denied($q$select uniguacu_private.require_active_collaborator(null)$q$,'23514');
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
update public.collaborators set active=false;
select pg_temp.m2_assert_registry('collaborators','Pessoa M2 editada',false,5);
reset role;
set local role uniguacu_owner;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
do $$ declare recipient uuid; begin
  select id into strict recipient from public.collaborators;
  perform pg_temp.m2_denied(format('select uniguacu_private.require_active_collaborator(%L)',recipient),'23514');
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
select pg_temp.m2_denied($$select uniguacu_private.require_active_collaborator(null)$$,'42501');
reset role;
rollback;
\echo 'M2: roteiro transacional concluído; exige postcheck independente. Não aprova M2/API/concorrência.'