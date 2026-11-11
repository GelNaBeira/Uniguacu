\set ON_ERROR_STOP on
-- Colaborador e operador fictícios previamente preparados, autorizados e ativos.
begin isolation level read committed;
set local application_name = 'uniguacu_phase2_a';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
set local role uniguacu_owner;
select set_config('request.jwt.claim.sub', :'operator_id', true);
select uniguacu_private.require_active_collaborator(:'collaborator_id'::uuid);
\echo 'Lock FOR SHARE mantido. Inicie recipient_b, observe bloqueio em C; COMMIT manual A libera B.'