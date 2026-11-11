\set ON_ERROR_STOP on
-- Preparação para execução futura autorizada; nenhuma conexão nesta tarefa.
begin isolation level repeatable read read only;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
\ir phase2_m2_readonly_checks.sql
\ir phase2_m2_snapshot.sql
select json_build_object('schema',2,'project','nlqnljmuzdplxdkmnqot',
  'version',:'snapshot_version','history',:'snapshot_history','structure',:'snapshot_structure',
  'database_oid',:'snapshot_database_oid','state',:'snapshot_state','auth',:'snapshot_auth',
  'backend_pid',pg_backend_pid(),'captured_at',clock_timestamp())::text;
rollback;