\set ON_ERROR_STOP on
-- Projeto vinculado pelo endpoint fixo + TLS verify-full, não por variável SQL.
\echo M1_DIAG:PF_BEGIN
begin isolation level repeatable read read only;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
\ir phase2_m1_readonly_checks.sql
\echo M1_DIAG:PF_SNAPSHOT
\ir phase2_m1_snapshot.sql
\echo M1_DIAG:PF_BASELINE
select json_build_object('schema',1,'project','nlqnljmuzdplxdkmnqot',
  'version', :'snapshot_version', 'history', :'snapshot_history',
  'structure', :'snapshot_structure', 'database_oid', :'snapshot_database_oid',
  'backend_pid', pg_backend_pid(), 'captured_at', clock_timestamp())::text;
rollback;
\echo M1_DIAG:PF_DONE