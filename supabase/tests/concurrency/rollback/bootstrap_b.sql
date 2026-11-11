\set ON_ERROR_STOP on
begin isolation level read committed;
set local application_name = 'uniguacu_phase2_b';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
-- Após rollback A, B deve conseguir bootstrap dentro da própria transação.
select uniguacu_private.bootstrap_first_admin(:'admin_b'::uuid, 'Bootstrap fictício para rollback B');
set local role uniguacu_owner;
select set_config('uniguacu.test.admin_b', :'admin_b', true);
do $$ begin
  if (select count(*) from public.operator_access where active and role='admin') <> 1
    or not exists (select 1 from public.operator_access where user_id=current_setting('uniguacu.test.admin_b')::uuid
      and active and role='admin') then raise exception 'Bootstrap B inesperado'; end if;
end $$;
rollback;
\echo 'PASS parcial: B liberada após rollback A; exige bloqueio observado e verificação persistida.'