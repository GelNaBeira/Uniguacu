\set ON_ERROR_STOP on
-- Estado inicial vazio; identidades Auth fictícias já provisionadas por canal autorizado.
begin isolation level read committed;
set local application_name = 'uniguacu_phase2_a';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
select uniguacu_private.bootstrap_first_admin(:'admin_a'::uuid, 'Concorrência: bootstrap A');
\echo 'A mantida ABERTA. Inicie bootstrap B, confirme bloqueio em C e só então COMMIT manual em A.'