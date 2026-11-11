\set ON_ERROR_STOP on
\set VERBOSITY verbose
begin isolation level read committed;
set local application_name = 'uniguacu_phase2_b';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
select uniguacu_private.bootstrap_first_admin(:'admin_b'::uuid, 'Concorrência: bootstrap B');
rollback;
\echo 'FALHA: bootstrap B deveria ter sido rejeitado com 23514; não houve commit de B.'
\quit 1