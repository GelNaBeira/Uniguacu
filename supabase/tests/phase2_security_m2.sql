\set ON_ERROR_STOP on
-- Exclusivamente após M2. Não é o gate da M1 nem é chamado pelo runner hospedado atual.
-- Banco descartável autorizado; hospedado somente pelo runner específico e após aprovação.
-- Toda fixture e alteração é revertida. Não usar service_role para testar RLS.
begin;
\ir phase2_validate_m1.sql
set local role uniguacu_owner;
do $$ begin
  if exists (select 1 from public.operator_access)
    or exists (select 1 from public.collaborators)
    or exists (select 1 from public.catalog_items)
    or exists (select 1 from public.administrative_audit)
    or exists (select 1 from uniguacu_private.access_control where bootstrapped) then
    raise exception 'Teste exige fundação vazia e bootstrap não utilizado';
  end if;
end $$;
reset role;
do $$ begin
  if exists (select 1 from auth.users where id in (
    '00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000099')) then
    raise exception 'Colisão de UUID Auth: nenhuma fixture inserida';
  end if;
  if exists (select 1 from pg_class where oid in ('public.collaborators'::regclass, 'public.catalog_items'::regclass)
    and (relowner <> 'uniguacu_owner'::regrole or not relrowsecurity or relforcerowsecurity)) then
    raise exception 'FALHA: propriedade/RLS M2';
  end if;
  if (select count(*) from pg_policies where schemaname = 'public'
    and tablename in ('operator_access', 'administrative_audit', 'collaborators', 'catalog_items')) <> 9 then
    raise exception 'FALHA: conjunto inesperado de políticas';
  end if;
end $$;

insert into auth.users(id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000004');
select uniguacu_private.bootstrap_first_admin('00000000-0000-4000-8000-000000000001', 'Fixture local de teste');
do $$ begin
  begin
    perform uniguacu_private.bootstrap_first_admin('00000000-0000-4000-8000-000000000002', 'Segundo bootstrap proibido');
    raise exception 'FALHA: bootstrap repetido permitido';
  exception when check_violation then null;
  end;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.set_operator_access('00000000-0000-4000-8000-000000000002', 'user', true, 'Usuário fictício de teste');
select public.set_operator_access('00000000-0000-4000-8000-000000000003', 'user', false, 'Inativo fictício de teste');
insert into public.collaborators(display_name, active) values ('Pessoa Fictícia Ativa', true), ('Pessoa Fictícia Inativa', false);
insert into public.catalog_items(name, nature, active) values
  ('Produto Fictício', 'returnable', true), ('Consumível Fictício', 'consumable', true), ('Item Inativo', 'returnable', false);
do $$ begin
  if (select count(*) from public.collaborators) <> 2 then raise exception 'FALHA: admin não consulta inativos'; end if;
  if (select count(*) from public.administrative_audit) < 8 then raise exception 'FALHA: auditoria incompleta'; end if;
  begin
    perform public.set_operator_access('00000000-0000-4000-8000-000000000001', 'user', true, 'Tentativa último administrador');
    raise exception 'FALHA: último admin rebaixado';
  exception when check_violation then null; end;
  begin
    perform public.set_operator_access('00000000-0000-4000-8000-000000000001', 'admin', false, 'Tentativa desativação final');
    raise exception 'FALHA: último admin desativado';
  exception when check_violation then null; end;
  begin
    insert into public.catalog_items(name, nature) values ('Inválido', 'academic');
    raise exception 'FALHA: natureza inválida aceita';
  exception when check_violation then null; end;
  begin
    perform public.set_operator_access('00000000-0000-4000-8000-000000000099', 'user', true, 'Referência Auth inexistente');
    raise exception 'FALHA: identidade Auth inexistente aceita';
  exception when foreign_key_violation then null; end;
  if (select count(*) from public.administrative_audit) <> 8 then
    raise exception 'FALHA: tentativa inválida deixou auditoria parcial';
  end if;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$ declare n integer; begin
  if (select count(*) from public.operator_access) <> 1 then raise exception 'FALHA: acesso de outro operador visível'; end if;
  if (select count(*) from public.collaborators) <> 1 then raise exception 'FALHA: colaborador inativo visível'; end if;
  if (select count(*) from public.catalog_items) <> 2 then raise exception 'FALHA: catálogo operacional incorreto'; end if;
  if exists (select 1 from public.administrative_audit) then raise exception 'FALHA: usuário lê auditoria'; end if;
  if not uniguacu_private.has_permission('loans:create') or uniguacu_private.has_permission('users:manage') then
    raise exception 'FALHA: matriz de permissões'; end if;
  begin
    perform public.set_operator_access('00000000-0000-4000-8000-000000000002', 'admin', true, 'Elevação proibida');
    raise exception 'FALHA: autoelevação permitida';
  exception when insufficient_privilege then null; end;
  begin
    update public.operator_access set role = 'admin';
    raise exception 'FALHA: escrita direta de papel';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.collaborators(display_name, active) values ('Não permitido', true);
    raise exception 'FALHA: cadastro comum permitido';
  exception when insufficient_privilege then null; end;
  update public.catalog_items set active = false;
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'FALHA: comum altera catálogo'; end if;
  begin
    perform created_at from public.operator_access;
    raise exception 'FALHA: coluna administrativa exposta';
  exception when insufficient_privilege then null; end;
  begin
    perform uniguacu_private.bootstrap_first_admin('00000000-0000-4000-8000-000000000002', 'Bootstrap pela API');
    raise exception 'FALHA: bootstrap acessível';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
do $$ begin
  if exists(select 1 from public.collaborators) or exists(select 1 from public.catalog_items)
    or exists(select 1 from public.operator_access) then raise exception 'FALHA: inativo consulta dados'; end if;
end $$;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
do $$ begin
  if exists(select 1 from public.catalog_items) then raise exception 'FALHA: não cadastrado consulta dados'; end if;
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform id from public.catalog_items;
    raise exception 'FALHA: anônimo consulta catálogo';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Teste privilegiado da integridade, não deve ser confundido com teste RLS.
-- SET ROLE explícito impede falso positivo por ausência de privilégios de postgres.
set local role uniguacu_owner;
do $$ begin
  begin
    delete from public.operator_access where user_id = '00000000-0000-4000-8000-000000000001';
    raise exception 'FALHA: último admin excluído';
  exception when check_violation then null; end;
  begin
    update public.operator_access set user_id = '00000000-0000-4000-8000-000000000004'
      where user_id = '00000000-0000-4000-8000-000000000002';
    raise exception 'FALHA: identidade mutável';
  exception when check_violation then null; end;
  begin
    delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
    raise exception 'FALHA: owner acessou Auth diretamente';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  begin
    truncate public.operator_access;
    raise exception 'FALHA: truncate permitido';
  exception when insufficient_privilege then
    if sqlerrm <> 'Truncamento de operadores proibido' then raise; end if;
  end;
  begin
    delete from auth.users where id = '00000000-0000-4000-8000-000000000001';
    raise exception 'FALHA: Auth referenciado excluído';
  exception when foreign_key_violation then null; end;
end $$;

-- Remoção válida com outro administrador, seguida da proteção do sobrevivente.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select public.set_operator_access('00000000-0000-4000-8000-000000000004', 'admin', true, 'Segundo administrador fictício');
set local role uniguacu_owner;
delete from public.operator_access where user_id = '00000000-0000-4000-8000-000000000004';
do $$ begin
  if (select count(*) from public.operator_access where active and role = 'admin') <> 1 then
    raise exception 'FALHA: remoção válida alterou invariante';
  end if;
end $$;

-- Helper interno: invocação com dono técnico e identidade de operador na sessão.
set local role uniguacu_owner;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
do $$ declare v_id uuid; begin
  select id into v_id from public.collaborators where active;
  perform uniguacu_private.require_active_collaborator(v_id);
  select id into v_id from public.collaborators where not active;
  begin
    perform uniguacu_private.require_active_collaborator(v_id);
    raise exception 'FALHA: destinatário inativo aceito';
  exception when check_violation then null; end;
  begin
    perform uniguacu_private.require_active_collaborator('00000000-0000-4000-8000-000000000004');
    raise exception 'FALHA: UUID de usuário aceito como destinatário';
  exception when check_violation then null; end;
end $$;
reset role;
rollback;
\echo 'PASS: suíte SQL transacional; fixtures revertidas. Concorrência/API Auth exigem suites adicionais.'