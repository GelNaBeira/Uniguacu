\set ON_ERROR_STOP on
-- SOMENTE M1. Fixtures SQL sintéticas NÃO são identidades de login Auth.
-- Exige autorização de escrita transacional; nenhum COMMIT neste arquivo.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';
\ir phase2_validate_m1.sql
set local role uniguacu_owner;
do $$ begin
  if exists (select 1 from public.operator_access)
    or exists (select 1 from public.administrative_audit)
    or (select count(*) from uniguacu_private.access_control where singleton and not bootstrapped) <> 1 then
    raise exception 'Exige M1 vazia e bootstrap não utilizado';
  end if;
end $$;
select version as m1_initial_version from uniguacu_private.access_control where singleton \gset
reset role;
do $$ begin
  if exists (select 1 from auth.users where id in (
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005', '00000000-0000-4000-8000-000000000099')) then
    raise exception 'Colisão Auth: abortar sem reutilizar identidades';
  end if;
end $$;
insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000004'),
  ('00000000-0000-4000-8000-000000000005');

-- Helpers temporários de teste: snapshot completo dos objetos alterados pela RPC.
set local role uniguacu_owner;
create temporary table m1_test_marker (id integer) on commit drop;
create function pg_temp.m1_snapshot() returns jsonb language sql as $$
  select jsonb_build_object(
    'operators', (select coalesce(jsonb_agg(to_jsonb(o) order by user_id), '[]'::jsonb) from public.operator_access o),
    'audit', (select coalesce(jsonb_agg(to_jsonb(a) order by id), '[]'::jsonb) from public.administrative_audit a),
    'control', (select to_jsonb(c) from uniguacu_private.access_control c));
$$;
create function pg_temp.m1_expect(p_sql text, p_state text, p_message text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare before_state jsonb; caught boolean := false; observed_state text; observed_message text;
begin
  before_state := pg_temp.m1_snapshot();
  begin
    execute p_sql;
  exception when others then
    get stacked diagnostics observed_state = returned_sqlstate, observed_message = message_text;
    if observed_state <> p_state or (p_message is not null and observed_message <> p_message) then
      raise exception 'SQLSTATE/mensagem inesperados: % / %', observed_state, observed_message;
    end if;
    caught := true;
  end;
  if not caught then raise exception 'Negativa esperada não ocorreu'; end if;
  if pg_temp.m1_snapshot() is distinct from before_state then
    raise exception 'Negativa deixou efeitos parciais (acesso/auditoria/mutex/bootstrap)';
  end if;
end $$;
-- O helper definer acima é só para integridade privilegiada; não representa o chamador API.
revoke all on function pg_temp.m1_snapshot() from public;
revoke all on function pg_temp.m1_expect(text,text,text) from public;
select pg_temp.m1_expect(
  $$select uniguacu_private.bootstrap_first_admin('00000000-0000-4000-8000-000000000099','UUID inexistente')$$, '23503');
select pg_temp.m1_expect(
  $$select uniguacu_private.bootstrap_first_admin('00000000-0000-4000-8000-000000000001','x')$$,
  '22023', 'Motivo obrigatório entre 5 e 500 caracteres');
reset role;
select uniguacu_private.bootstrap_first_admin('00000000-0000-4000-8000-000000000001', 'Bootstrap SQL fictício transacional');
set local role uniguacu_owner;
select pg_temp.m1_expect(
  $$select uniguacu_private.bootstrap_first_admin('00000000-0000-4000-8000-000000000002','Repetição proibida')$$,
  '23514', 'Bootstrap já utilizado');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.set_operator_access('00000000-0000-4000-8000-000000000002', 'user', true, 'Comum fictício transacional');
select public.set_operator_access('00000000-0000-4000-8000-000000000003', 'user', false, 'Inativo fictício transacional');
select public.set_operator_access('00000000-0000-4000-8000-000000000005', 'admin', false, 'Admin inativo fictício');
do $$ begin
  if (select count(*) from public.administrative_audit) <> 4 then raise exception 'Auditoria inicial incompleta'; end if;
  begin
    perform public.set_operator_access('00000000-0000-4000-8000-000000000001', 'user', true, 'Último admin via RPC');
    raise exception 'RPC removeu último admin';
  exception when sqlstate '23514' then
    if sqlerrm <> 'Último administrador ativo não pode ser removido' then raise; end if;
  end;
end $$;

-- Negativas de usuários: executar RPC sob authenticated (nunca em helper SECURITY DEFINER).
reset role;
set local role anon;
do $$ begin
  begin
    perform public.set_operator_access('00000000-0000-4000-8000-000000000002','admin',true,'Anônimo proibido');
    raise exception 'RPC anônima permitida';
  exception when sqlstate '42501' then null; end;
  begin
    perform user_id from public.operator_access;
    raise exception 'Leitura anônima permitida';
  exception when sqlstate '42501' then null; end;
end $$;
reset role;
set local role uniguacu_owner;
create temporary table m1_before_denials on commit drop as select pg_temp.m1_snapshot() as state;
reset role;
set local role authenticated;
do $$ declare who text; target uuid; result_state text; result_message text;
begin
  foreach who in array array[
    '', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003',
    '00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005'] loop
    perform set_config('request.jwt.claim.sub', who, true);
    if uniguacu_private.has_permission('users:manage') then raise exception 'Elevação na matriz'; end if;
    foreach target in array array[
      '00000000-0000-4000-8000-000000000001'::uuid,
      '00000000-0000-4000-8000-000000000002'::uuid,
      '00000000-0000-4000-8000-000000000004'::uuid] loop
      begin
        perform public.set_operator_access(target, 'admin', true, 'Tentativa elevação negada');
        raise exception 'RPC permitiu elevação';
      exception when sqlstate '42501' then
        get stacked diagnostics result_state = returned_sqlstate, result_message = message_text;
        if result_state <> '42501' or result_message <> 'Acesso negado' then raise; end if;
      end;
      begin
        perform public.set_operator_access(target, 'user', false, 'Tentativa revogação negada');
        raise exception 'RPC permitiu revogação';
      exception when sqlstate '42501' then
        if sqlerrm <> 'Acesso negado' then raise; end if;
      end;
    end loop;
  end loop;
end $$;
reset role;
set local role uniguacu_owner;
do $$ begin
  if pg_temp.m1_snapshot() is distinct from (select state from m1_before_denials) then
    raise exception 'Tentativas negadas deixaram efeitos parciais';
  end if;
end $$;
-- Último admin: privilégios suficientes, falha deve vir do guard, não de ACL.
select pg_temp.m1_expect(
  $$update public.operator_access set role='user' where user_id='00000000-0000-4000-8000-000000000001'$$,
  '23514', 'Último administrador ativo não pode ser removido');
select pg_temp.m1_expect(
  $$update public.operator_access set active=false where user_id='00000000-0000-4000-8000-000000000001'$$,
  '23514', 'Último administrador ativo não pode ser removido');
select pg_temp.m1_expect(
  $$delete from public.operator_access where user_id='00000000-0000-4000-8000-000000000001'$$,
  '23514', 'Último administrador ativo não pode ser removido');
reset role;
do $$ begin
  begin
    truncate public.operator_access;
    raise exception 'TRUNCATE permitido';
  exception when sqlstate '42501' then
    if sqlerrm <> 'Truncamento de operadores proibido' then raise; end if;
  end;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$ begin
  if (select count(*) from public.operator_access) <> 1
    or exists (select 1 from public.administrative_audit) then raise exception 'RLS comum incorreta'; end if;
  begin
    update public.operator_access set role='admin';
    raise exception 'Escrita direta permitida';
  exception when sqlstate '42501' then null; end;
  begin
    perform uniguacu_private.bootstrap_first_admin('00000000-0000-4000-8000-000000000002', 'API proibida');
    raise exception 'Bootstrap exposto';
  exception when sqlstate '42501' then null; end;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
do $$ begin
  if exists (select 1 from public.operator_access) or exists (select 1 from public.administrative_audit) then
    raise exception 'RLS inativo incorreta';
  end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.set_operator_access('00000000-0000-4000-8000-000000000004', 'admin', true, 'Segundo admin fictício');
select public.set_operator_access('00000000-0000-4000-8000-000000000004', 'user', true, 'Rebaixamento válido com sobrevivente');
reset role;
set local role uniguacu_owner;
do $$ begin
  if (select count(*) from public.administrative_audit) <> 6
    or (select count(*) from public.operator_access where active and role='admin') <> 1 then
    raise exception 'Controle positivo/auditoria incorreto';
  end if;
end $$;
reset role;
rollback;
-- Checagem interna auxiliar. Runner exige ainda pós-check em conexão INDEPENDENTE,
-- inclusive se este arquivo abortar antes de chegar aqui.
begin read only;
set local role uniguacu_owner;
select set_config('uniguacu.test.initial_version', :'m1_initial_version', true);
do $$ begin
  if exists (select 1 from public.operator_access) or exists (select 1 from public.administrative_audit)
    or not exists (select 1 from uniguacu_private.access_control where singleton and not bootstrapped
      and version = current_setting('uniguacu.test.initial_version')::bigint) then
    raise exception 'Rollback não restaurou fundação';
  end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from auth.users where id in (
    '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005')) then raise exception 'Fixtures Auth persistiram'; end if;
end $$;
rollback;
\echo 'PASS: M1 transacional; não valida Auth/JWT real ou concorrência com commit.'