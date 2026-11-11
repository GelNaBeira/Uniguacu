-- Reutiliza fingerprint da M1 sem alterar seu artefato.
\ir phase2_m1_snapshot.sql
with relations as (
  select oid from pg_class where oid in ('public.collaborators'::regclass,'public.catalog_items'::regclass)
), fingerprints as (
  select 'relation:'||oid as k, jsonb_build_object('owner',relowner,'kind',relkind,
    'acl',relacl,'rls',relrowsecurity,'force',relforcerowsecurity) as v
    from pg_class c where oid in (select oid from relations)
  union all select 'column:'||attrelid||':'||attnum,to_jsonb(a) from pg_attribute a
    where attrelid in (select oid from relations) and attnum>0 and not attisdropped
  union all select 'default:'||oid,jsonb_build_object('catalog',to_jsonb(d),'expr',pg_get_expr(adbin,adrelid))
    from pg_attrdef d where adrelid in (select oid from relations)
  union all select 'constraint:'||oid,to_jsonb(c) from pg_constraint c where conrelid in (select oid from relations)
  union all select 'policy:'||oid,to_jsonb(p) from pg_policy p where polrelid in (select oid from relations)
  union all select 'trigger:'||oid,to_jsonb(t) from pg_trigger t where tgrelid in (select oid from relations)
  union all select 'index:'||indexrelid,jsonb_build_object('catalog',to_jsonb(i),'definition',pg_get_indexdef(indexrelid))
    from pg_index i where indrelid in (select oid from relations)
)
select md5(:'snapshot_structure'||coalesce(jsonb_agg(jsonb_build_object('key',k,'value',v) order by k)::text,'[]'))
  as snapshot_structure from fingerprints \gset
set local role uniguacu_owner;
select md5(jsonb_build_object(
  'operators',(select coalesce(jsonb_agg(to_jsonb(o) order by user_id),'[]') from public.operator_access o),
  'audit',(select coalesce(jsonb_agg(to_jsonb(a) order by id),'[]') from public.administrative_audit a),
  'control',(select to_jsonb(c) from uniguacu_private.access_control c),
  'collaborators',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.collaborators c),
  'catalog',(select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]') from public.catalog_items c)
)::text) as snapshot_state \gset
reset role;
select md5(coalesce(jsonb_agg(to_jsonb(u) order by id)::text,'[]')) as snapshot_auth
  from auth.users u where id in (
    '00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',
    '00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004') \gset