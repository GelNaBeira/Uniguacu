-- Include somente leitura, sem exportar linhas Auth, SQL histórico ou dados pessoais.
select md5(coalesce(jsonb_agg(to_jsonb(m) order by version)::text,'[]')) as snapshot_history
  from supabase_migrations.schema_migrations m \gset
select oid::text as snapshot_database_oid from pg_database where datname=current_database() \gset
with relations as (
  select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where (n.nspname='public' and c.relname in ('operator_access','administrative_audit'))
    or (n.nspname='uniguacu_private' and c.relname='access_control')
), fingerprints as (
  select 'relation:'||c.oid as k, jsonb_build_object('owner',c.relowner,'kind',c.relkind,
    'acl',c.relacl,'rls',c.relrowsecurity,'force',c.relforcerowsecurity) as v
    from pg_class c where c.oid in (select oid from relations)
  union all select 'column:'||a.attrelid||':'||a.attnum,
    jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'acl',a.attacl,'default',pg_get_expr(d.adbin,d.adrelid))
    from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum
    where a.attrelid in (select oid from relations) and a.attnum>0 and not a.attisdropped
  union all select 'constraint:'||c.oid,to_jsonb(c) from pg_constraint c where c.conrelid in (select oid from relations)
  union all select 'policy:'||p.oid,to_jsonb(p) from pg_policy p where p.polrelid in (select oid from relations)
  union all select 'trigger:'||t.oid,to_jsonb(t) from pg_trigger t where t.tgrelid in (select oid from relations)
  union all select 'index:'||i.indexrelid,jsonb_build_object('catalog',to_jsonb(i),'definition',pg_get_indexdef(i.indexrelid))
    from pg_index i where i.indrelid in (select oid from relations)
  union all select 'function:'||p.oid,jsonb_build_object('definition',pg_get_functiondef(p.oid),
      'owner',p.proowner,'acl',p.proacl,'config',p.proconfig)
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='uniguacu_private' or (n.nspname='public' and p.proname='set_operator_access')
  union all select 'namespace:'||n.oid,to_jsonb(n) from pg_namespace n where n.nspname='uniguacu_private'
  union all select 'role:'||r.oid,to_jsonb(r) from pg_roles r where r.rolname='uniguacu_owner'
  union all select 'membership:'||m.oid,to_jsonb(m) from pg_auth_members m
    where m.roleid='uniguacu_owner'::regrole or m.member='uniguacu_owner'::regrole
  union all select 'default:'||d.oid,to_jsonb(d) from pg_default_acl d where d.defaclrole='uniguacu_owner'::regrole
)
select md5(coalesce(jsonb_agg(jsonb_build_object('key',k,'value',v) order by k)::text,'[]')) as snapshot_structure
  from fingerprints \gset
set local role uniguacu_owner;
select version::text as snapshot_version from uniguacu_private.access_control where singleton \gset
reset role;