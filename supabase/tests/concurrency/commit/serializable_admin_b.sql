\set ON_ERROR_STOP on
\set VERBOSITY verbose
-- Usar com last_admin_a.sql. Snapshot fixado antes do commit A.
begin isolation level serializable;
set local application_name = 'uniguacu_phase2_b';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin_b', true);
select public.set_operator_access(:'admin_b'::uuid, 'admin', false, 'Concorrência: serializable B');
rollback;
\echo 'FALHA: B deveria falhar 40001 na atualização do mutex; nenhuma alteração B confirmada.'
\quit 1