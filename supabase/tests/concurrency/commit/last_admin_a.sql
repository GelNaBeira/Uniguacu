\set ON_ERROR_STOP on
-- Duas identidades Auth fictícias previamente autorizadas, ambas admins ativas.
-- Parâmetros psql: admin_a, admin_b. Não cria nem remove fixtures.
begin isolation level read committed;
set local application_name = 'uniguacu_phase2_a';
set local lock_timeout = '30s';
set local statement_timeout = '60s';
set local role uniguacu_owner;
select set_config('uniguacu.test.admin_a', :'admin_a', true);
select set_config('uniguacu.test.admin_b', :'admin_b', true);
do $$ begin
  if current_setting('uniguacu.test.admin_a')::uuid = current_setting('uniguacu.test.admin_b')::uuid
    or (select count(*) from public.operator_access where active and role = 'admin') <> 2
    or (select count(*) from public.operator_access where active and role = 'admin'
      and user_id in (current_setting('uniguacu.test.admin_a')::uuid, current_setting('uniguacu.test.admin_b')::uuid)) <> 2 then
    raise exception 'Exige exatamente os dois administradores fictícios autorizados';
  end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub', :'admin_a', true);
select public.set_operator_access(:'admin_a'::uuid, 'admin', false, 'Concorrência: autodesativação A');
\echo 'A mantida ABERTA. Inicie B em outra sessão; confirme bloqueio pela sessão C; só então COMMIT manual em A.'