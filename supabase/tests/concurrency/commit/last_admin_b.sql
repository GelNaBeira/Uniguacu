\set ON_ERROR_STOP on
\set VERBOSITY verbose
begin isolation level read committed;
set local application_name = 'uniguacu_phase2_b';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin_b', true);
-- Deve aguardar A e depois falhar com 23514 (último admin); nunca confirmar ambos.
select public.set_operator_access(:'admin_b'::uuid, 'admin', false, 'Concorrência: autodesativação B');
-- Se chegar aqui, rollback evita confirmar resultado inesperado.
rollback;
\echo 'FALHA: B deveria ter sido rejeitada com 23514; não houve commit de B.'
\quit 1