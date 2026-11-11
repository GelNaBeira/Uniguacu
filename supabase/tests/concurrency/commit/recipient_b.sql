\set ON_ERROR_STOP on
begin isolation level read committed;
set local application_name = 'uniguacu_phase2_b';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin_id', true);
select set_config('uniguacu.test.collaborator_id', :'collaborator_id', true);
do $$ declare affected integer; begin
  update public.collaborators set active = false
    where id = current_setting('uniguacu.test.collaborator_id')::uuid and active;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'FALHA: destinatário não alterado após espera'; end if;
end $$;
-- Sucesso sem persistir a desativação; teste de contenção não é operação de estoque.
rollback;
\echo 'PASS parcial: UPDATE concluído após liberação; só válido com bloqueio comprovado por C.'