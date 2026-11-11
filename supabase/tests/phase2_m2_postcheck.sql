\set ON_ERROR_STOP on
-- Exige NOVA conexão/processo e baseline persistida pelo orquestrador, inclusive após erro da suíte.
begin isolation level repeatable read read only;
set local statement_timeout = '30s';
set local lock_timeout = '5s';
\ir phase2_m2_readonly_checks.sql
\ir phase2_m2_snapshot.sql
select (:'snapshot_version'=:'baseline_version' and :'snapshot_history'=:'baseline_history'
  and :'snapshot_structure'=:'baseline_structure' and :'snapshot_database_oid'=:'baseline_database_oid'
  and :'snapshot_state'=:'baseline_state' and :'snapshot_auth'=:'baseline_auth') as postcheck_ok \gset
\if :postcheck_ok
select json_build_object('postcheck','PASS','version',:'snapshot_version','history',:'snapshot_history',
  'structure',:'snapshot_structure','database_oid',:'snapshot_database_oid',
  'state',:'snapshot_state','auth',:'snapshot_auth','backend_pid',pg_backend_pid())::text;
\else
do $$ begin raise exception 'Pós-check M2 divergente; preservar evidências sem limpeza'; end $$;
\endif
rollback;