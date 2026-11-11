\set ON_ERROR_STOP on
\set VERBOSITY verbose
-- Usar com last_admin_a.sql: A desativa a si mesma, B tenta agir como A.
begin isolation level read committed;
set local application_name = 'uniguacu_phase2_b';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin_a', true);
select public.set_operator_access(:'admin_b'::uuid, 'user', true, 'Concorrência: administrador revogado aguardando');
rollback;
\echo 'FALHA: sessão revogada deveria falhar 42501 após espera; nenhuma alteração B confirmada.'
\quit 1