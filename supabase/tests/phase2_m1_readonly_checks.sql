-- Include: exige transação READ ONLY aberta pelo chamador.
\echo M1_DIAG:PF_SESSION
do $$ declare required text; begin
  if current_setting('transaction_read_only') <> 'on'
    or current_user <> 'postgres' or session_user <> 'postgres'
    or current_database() <> 'postgres'
    or current_setting('server_version_num')::integer not between 170000 and 179999 then
    raise exception 'Sessão, TLS, banco, versão ou modo somente leitura incompatível';
  end if;
end $$;
\echo M1_DIAG:PF_BACKEND_TLS
do $$ begin
  if not exists (select 1 from pg_stat_ssl where pid=pg_backend_pid() and ssl) then
    raise exception 'TLS backend incompatível';
  end if;
end $$;
\echo M1_DIAG:PF_HISTORY
do $$ begin
  if to_regclass('supabase_migrations.schema_migrations') is null then raise exception 'Histórico ausente'; end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 3
    or (select count(*) from supabase_migrations.schema_migrations where (version,name) in (
      ('20261104224035','initialize_almoxarifado'),
      ('20261104231607','remove_almoxarifado_requested_by_owner'),
      ('20261107205423','access_foundation'))) <> 3 then
    raise exception 'Histórico inexato';
  end if;
end $$;
\echo M1_DIAG:PF_OBJECTS
do $$ declare required text; begin
  if to_regnamespace('uniguacu_private') is null or to_regrole('uniguacu_owner') is null then
    raise exception 'Schema/proprietário M1 ausente';
  end if;
  foreach required in array array['public.operator_access','public.administrative_audit',
    'uniguacu_private.access_control','auth.users'] loop
    if to_regclass(required) is null then raise exception 'Objeto obrigatório ausente: %', required; end if;
  end loop;
  foreach required in array array['auth.uid()', 'uniguacu_private.current_auth_uid()',
    'uniguacu_private.has_permission(text)', 'uniguacu_private.guard_operator_change()',
    'uniguacu_private.bootstrap_first_admin(uuid,text)', 'public.set_operator_access(uuid,text,boolean,text)'] loop
    if to_regprocedure(required) is null then raise exception 'Função obrigatória ausente: %', required; end if;
  end loop;
  if to_regclass('public.collaborators') is not null or to_regclass('public.catalog_items') is not null
    or to_regprocedure('uniguacu_private.audit_registry_change()') is not null
    or to_regprocedure('uniguacu_private.require_active_collaborator(uuid)') is not null then
    raise exception 'M2 detectada';
  end if;
end $$;
\echo M1_DIAG:PF_STATE_AUTH
do $$ begin
  if exists(select 1 from public.operator_access) then raise exception 'Operador persistido'; end if;
  if auth.uid() is not null then raise exception 'Sessão administrativa contém identidade JWT'; end if;
  if exists(select 1 from auth.users where id in (
    '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',
    '00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000099')) then
    raise exception 'UUID sintético presente no estado persistido';
  end if;
end $$;
\ir phase2_validate_m1.sql
\echo M1_DIAG:PF_SET_OWNER
set local role uniguacu_owner;
\echo M1_DIAG:PF_OWNER_STATE
do $$ begin
  if exists(select 1 from public.administrative_audit)
    or (select count(*) from uniguacu_private.access_control) <> 1
    or not exists(select 1 from uniguacu_private.access_control where singleton and not bootstrapped) then
    raise exception 'M1 não está vazia ou bootstrap utilizado';
  end if;
end $$;
\echo M1_DIAG:PF_RESET_ROLE
reset role;