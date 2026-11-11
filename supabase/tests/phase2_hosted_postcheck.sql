\set ON_ERROR_STOP on
-- NOVO processo/conexão psql. Baseline lida do disco pelo runner.
begin isolation level repeatable read read only;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
\ir phase2_m1_readonly_checks.sql
\ir phase2_m1_snapshot.sql
select (:'snapshot_version' = :'baseline_version'
  and :'snapshot_history' = :'baseline_history'
  and :'snapshot_structure' = :'baseline_structure'
  and :'snapshot_database_oid' = :'baseline_database_oid') as postcheck_ok \gset
\if :postcheck_ok
select json_build_object('postcheck','PASS','backend_pid',pg_backend_pid(),
  'version',:'snapshot_version','history',:'snapshot_history','structure',:'snapshot_structure',
  'database_oid',:'snapshot_database_oid')::text;
\else
do $$ begin raise exception 'Pós-check divergente: versão, histórico, estrutura ou banco'; end $$;
\endif
rollback;