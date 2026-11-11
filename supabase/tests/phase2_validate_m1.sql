\set ON_ERROR_STOP on
-- Apenas catálogos; pode ser incluído na transação da suíte SQL.
\echo M1_DIAG:V_CATALOG
do $$ declare r record; required text; begin
  foreach required in array array['uniguacu_private.current_auth_uid()',
    'uniguacu_private.has_permission(text)', 'uniguacu_private.guard_operator_change()',
    'uniguacu_private.bootstrap_first_admin(uuid,text)', 'public.set_operator_access(uuid,text,boolean,text)'] loop
    if to_regprocedure(required) is null then raise exception 'FALHA: função ausente: %', required; end if;
  end loop;
  if (select count(*) from pg_policy where polrelid='public.operator_access'::regclass) <> 2
    or (select count(*) from pg_policy where polrelid='public.administrative_audit'::regclass) <> 1 then
    raise exception 'FALHA: conjunto de políticas inesperado';
  end if;
  if not exists(select 1 from pg_namespace where nspname='uniguacu_private' and nspowner='uniguacu_owner'::regrole)
    or not exists(select 1 from pg_class where oid='uniguacu_private.access_control'::regclass
      and relkind='r' and relowner='uniguacu_owner'::regrole) then
    raise exception 'FALHA: propriedade do schema/controle';
  end if;
  if not exists (select 1 from pg_roles where rolname = 'uniguacu_owner'
    and not rolcanlogin and not rolsuper and not rolbypassrls and not rolcreatedb
    and not rolcreaterole and not rolinherit) then
    raise exception 'FALHA: atributos do proprietário técnico';
  end if;
end $$;
\echo M1_DIAG:V_MEMBERSHIP
do $$ begin
  if not exists (select 1 from pg_auth_members
    where roleid = 'uniguacu_owner'::regrole and member = 'postgres'::regrole
      and grantor <> 'postgres'::regrole
      and admin_option and not inherit_option and not set_option)
    or not exists (select 1 from pg_auth_members
      where roleid = 'uniguacu_owner'::regrole and member = 'postgres'::regrole
        and grantor = 'postgres'::regrole
        and not admin_option and not inherit_option and set_option)
    or not pg_has_role('postgres', 'uniguacu_owner', 'SET')
    or pg_has_role('postgres', 'uniguacu_owner', 'USAGE') then
    raise exception 'FALHA: associação postgres/owner';
  end if;
  if exists (select 1 from pg_roles where rolname in ('anon', 'authenticated', 'service_role', 'authenticator')
    and pg_has_role(oid, 'uniguacu_owner'::regrole, 'MEMBER')) then
    raise exception 'FALHA: API associada ao proprietário';
  end if;
end $$;
\echo M1_DIAG:V_AUTH_ACL
do $$ begin
  if not has_schema_privilege('postgres', 'auth', 'USAGE')
    or not has_column_privilege('postgres', 'auth.users', 'id', 'REFERENCES')
    or not has_function_privilege('postgres', 'auth.uid()', 'EXECUTE') then
    raise exception 'FALHA: dependências Auth';
  end if;
end $$;
\echo M1_DIAG:V_INTERNAL_ACL
do $$ begin
  if has_schema_privilege('uniguacu_owner', 'public', 'CREATE') then
    raise exception 'FALHA: CREATE público temporário não revogado';
  end if;
  if has_schema_privilege('anon', 'uniguacu_private', 'USAGE')
    or has_schema_privilege('authenticated', 'uniguacu_private', 'CREATE')
    or not has_schema_privilege('authenticated', 'uniguacu_private', 'USAGE')
    or has_table_privilege('uniguacu_owner', 'public.operator_access', 'TRUNCATE')
    or exists (select 1 from unnest(array['SELECT','INSERT','UPDATE','DELETE','TRIGGER']) p(privilege)
      where not has_table_privilege('uniguacu_owner', 'public.operator_access', p.privilege)) then
    raise exception 'FALHA: schema privado/privilégios internos';
  end if;
  if not exists (select 1 from pg_policy where polrelid = 'public.operator_access'::regclass
    and polname = 'operator_internal_access' and polcmd = '*'
    and polroles = array['uniguacu_owner'::regrole::oid]
    and pg_get_expr(polqual, polrelid) = 'true'
    and pg_get_expr(polwithcheck, polrelid) = 'true') then
    raise exception 'FALHA: política interna de operadores';
  end if;
  if not exists (select 1 from pg_default_acl d
    where d.defaclrole = 'uniguacu_owner'::regrole and d.defaclnamespace = 0
      and d.defaclobjtype = 'f')
    or exists (select 1 from pg_default_acl d,
      lateral aclexplode(d.defaclacl) a
      where d.defaclrole = 'uniguacu_owner'::regrole and d.defaclobjtype = 'f'
        and a.grantee = 0 and a.privilege_type = 'EXECUTE') then
    raise exception 'FALHA: defaults de funções permitem PUBLIC';
  end if;
end $$;
\echo M1_DIAG:V_RLS_FUNCTIONS
do $$ declare r record; begin
  for r in select c.relname, c.relowner, c.relrowsecurity, c.relforcerowsecurity
    from pg_class c where c.oid in ('public.operator_access'::regclass, 'public.administrative_audit'::regclass)
  loop
    if r.relowner <> (case when r.relname = 'operator_access' then 'postgres'::regrole
        else 'uniguacu_owner'::regrole end) or not r.relrowsecurity or r.relforcerowsecurity then
      raise exception 'FALHA: propriedade/RLS de %', r.relname;
    end if;
  end loop;
  for r in select p.oid, p.proname, p.proowner, p.prosecdef, p.proconfig, p.proacl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'uniguacu_private'
      or p.oid = 'public.set_operator_access(uuid,text,boolean,text)'::regprocedure
  loop
    if not r.prosecdef or not coalesce(r.proconfig @> array['search_path=""'], false)
      or r.proowner <> (case when r.proname = 'current_auth_uid' then 'postgres'::regrole
        else 'uniguacu_owner'::regrole end) then
      raise exception 'FALHA: SECURITY DEFINER/proprietário/search_path de %', r.proname;
    end if;
    if exists (select 1 from aclexplode(coalesce(r.proacl, acldefault('f', r.proowner)))
      where grantee = 0 and privilege_type = 'EXECUTE') then
      raise exception 'FALHA: PUBLIC executa %', r.proname;
    end if;
    if has_function_privilege('anon', r.oid, 'EXECUTE')
      or has_function_privilege('service_role', r.oid, 'EXECUTE')
      or has_function_privilege('authenticated', r.oid, 'EXECUTE') <>
        (r.proname in ('has_permission', 'set_operator_access')) then
      raise exception 'FALHA: ACL efetiva da API em %', r.proname;
    end if;
  end loop;
  if not has_function_privilege('uniguacu_owner', 'uniguacu_private.current_auth_uid()', 'EXECUTE')
    or not has_function_privilege('postgres', 'uniguacu_private.bootstrap_first_admin(uuid,text)', 'EXECUTE') then
    raise exception 'FALHA: ponte Auth/bootstrap indisponível';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.operator_access'::regclass
    and confrelid = 'auth.users'::regclass and contype = 'f' and confdeltype = 'r' and convalidated) then
    raise exception 'FALHA: FK Auth restritiva ausente';
  end if;
  if (select count(*) from pg_trigger where tgrelid = 'public.operator_access'::regclass
    and not tgisinternal and tgenabled = 'O'
    and tgname in ('operator_change_guard', 'operator_truncate_guard')) <> 2 then
    raise exception 'FALHA: triggers de proteção ausentes/desabilitados';
  end if;
  if not has_column_privilege('authenticated', 'public.operator_access', 'role', 'SELECT')
    or has_column_privilege('authenticated', 'public.operator_access', 'created_at', 'SELECT')
    or has_any_column_privilege('authenticated', 'public.operator_access', 'UPDATE')
    or has_table_privilege('authenticated', 'public.operator_access', 'DELETE') then
    raise exception 'FALHA: privilégios de operadores';
  end if;
end $$;
\echo M1_DIAG:V_SET_OWNER
set role uniguacu_owner;
\echo M1_DIAG:V_MUTEX
do $$ begin
  if (select count(*) from uniguacu_private.access_control where singleton) <> 1 then
    raise exception 'FALHA: mutex singleton';
  end if;
end $$;
\echo M1_DIAG:V_RESET_ROLE
reset role;