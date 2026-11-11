\set ON_ERROR_STOP on
-- Requer duas identidades fictícias já autorizadas/existentes; não cria Auth.
-- Executar com \i em sessão interativa mantida aberta, nunca --file isolado.
begin isolation level read committed;
set local application_name = 'uniguacu_phase2_a';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
select uniguacu_private.bootstrap_first_admin(:'admin_a'::uuid, 'Bootstrap fictício para rollback A');
\echo 'A aberta. Inicie B, comprove bloqueio em C e execute somente ROLLBACK em A.'