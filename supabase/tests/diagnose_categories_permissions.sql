-- DIAGNÓSTICO SOMENTE LEITURA. Executar no SQL Editor do projeto afetado.
-- Não é migration e não altera usuários, grants, RLS ou dados.
-- Não compartilhar resultados contendo IDs fora da equipe autorizada.
select
  has_schema_privilege('authenticated', 'private', 'USAGE') as private_usage,
  has_function_privilege('authenticated', 'private.is_admin()', 'EXECUTE') as is_admin_execute,
  has_function_privilege('authenticated', 'private.has_permission(text)', 'EXECUTE') as has_permission_execute,
  has_table_privilege('authenticated', 'public.categories', 'SELECT') as categories_select,
  has_column_privilege('authenticated', 'public.categories', 'name', 'INSERT') as categories_insert_name;

select p.oid::regprocedure as function_name, pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer, p.proconfig as settings, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'private' and p.proname in ('is_admin','has_permission');

select tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' and tablename in ('categories','usuarios')
order by tablename, policyname;

select relrowsecurity as rls_enabled, relforcerowsecurity as rls_forced
from pg_class where oid = 'public.categories'::regclass;

-- Compare o ID do log categories.authorization com o ID do perfil que foi editado.
select id, role, is_active from public.usuarios where role = 'ADMIN';

-- SQL Editor postgres normalmente não tem JWT de usuário: auth.uid() pode ser NULL.
-- Portanto, is_admin() falso no SQL Editor sem JWT NÃO prova falha da função.
select current_user, auth.uid() as sql_editor_auth_uid;

-- Executar ESTE BLOCO INTEIRO como postgres no SQL Editor.
-- Simula apenas o contexto SQL do ID confirmado nos logs; NÃO valida um JWT real.
-- SET LOCAL/set_config desaparecem no rollback. Nenhum INSERT é executado.
begin;
select set_config('request.jwt.claim.sub','9f42306e-394a-41b0-93a2-52cc6b5614f9',true);
select set_config('request.jwt.claims',
  '{"sub":"9f42306e-394a-41b0-93a2-52cc6b5614f9","role":"authenticated"}',true);
set local role authenticated;
select current_user as database_role,
  auth.uid() as simulated_auth_uid,
  private.is_admin() as is_admin_with_identity,
  has_schema_privilege(current_user,'private','USAGE') as private_usage,
  has_function_privilege(current_user,'private.is_admin()','EXECUTE') as is_admin_execute,
  has_column_privilege(current_user,'public.categories','name','INSERT') as insert_name;
select id, role, is_active from public.usuarios where id = auth.uid();
rollback;