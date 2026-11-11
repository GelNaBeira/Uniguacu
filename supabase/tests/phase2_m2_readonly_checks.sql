-- Include somente leitura. M2 já deve existir; este arquivo NÃO a aplica.
do $$ begin
  if current_user <> 'postgres' or session_user <> 'postgres'
    or current_setting('server_version_num')::integer not between 170000 and 179999 then
    raise exception 'M2 exige sessão postgres e PostgreSQL 17';
  end if;
  if (select count(*) from supabase_migrations.schema_migrations) <> 4
    or exists (select 1 from (values
      ('20261104224035','initialize_almoxarifado'),
      ('20261104231607','remove_almoxarifado_requested_by_owner'),
      ('20261107205423','access_foundation'),
      ('20261107210000','collaborators_catalog')) expected(version,name)
      where not exists (select 1 from supabase_migrations.schema_migrations m
        where m.version=expected.version and m.name=expected.name)) then
    raise exception 'Histórico M2 divergente; não reparar nem aplicar migrações';
  end if;
end $$;
\ir phase2_validate_m1.sql
do $$ declare t text; c text; r text; p text; allowed boolean; begin
  foreach t in array array['collaborators','catalog_items'] loop
    if not exists (select 1 from pg_class where oid=('public.'||t)::regclass
      and relkind='r' and relowner='uniguacu_owner'::regrole
      and relrowsecurity and not relforcerowsecurity) then
      raise exception 'Owner/RLS M2 incorreto: %', t;
    end if;
    if (select count(*) from pg_policy where polrelid=('public.'||t)::regclass) <> 3
      or (select count(*) from pg_trigger where tgrelid=('public.'||t)::regclass
        and not tgisinternal and tgenabled='O'
        and tgfoid='uniguacu_private.audit_registry_change()'::regprocedure
        and tgtype=23) <> 1 then
      raise exception 'Políticas/trigger M2 incorretos: %', t;
    end if;
    foreach r in array array['anon','authenticated','service_role'] loop
      foreach p in array array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER'] loop
        if has_table_privilege(r,'public.'||t,p) then
          raise exception 'Grant amplo inesperado: % / % / %',t,r,p;
        end if;
      end loop;
      for c in select attname from pg_attribute where attrelid=('public.'||t)::regclass
        and attnum>0 and not attisdropped loop
        foreach p in array array['SELECT','INSERT','UPDATE','REFERENCES'] loop
          allowed := r='authenticated' and
            ((p='SELECT' and c in ('id','display_name','name','nature','active'))
            or (p in ('INSERT','UPDATE') and c in ('display_name','name','nature','active')));
          if has_column_privilege(r,'public.'||t,c,p) <> allowed then
            raise exception 'ACL de coluna inesperada: % / % / % / %',t,r,c,p;
          end if;
        end loop;
      end loop;
    end loop;
  end loop;
  if to_regprocedure('uniguacu_private.require_active_collaborator(uuid)') is null then
    raise exception 'Helper de destinatários ausente';
  end if;
end $$;
-- Recusa ambiente ocupado; não esvazia nem reaproveita dados.
set local role uniguacu_owner;
do $$ begin
  if exists(select 1 from public.operator_access)
    or exists(select 1 from public.administrative_audit)
    or exists(select 1 from public.collaborators)
    or exists(select 1 from public.catalog_items)
    or (select count(*) from uniguacu_private.access_control where singleton and not bootstrapped) <> 1 then
    raise exception 'Exige fundação vazia e bootstrap livre; nenhuma limpeza automática';
  end if;
end $$;
reset role;
do $$ begin
  if exists(select 1 from auth.users where id in (
    '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004')) then
    raise exception 'Colisão de fixtures Auth; abortar sem reutilizar identidades';
  end if;
end $$;