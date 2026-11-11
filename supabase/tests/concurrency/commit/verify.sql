\set ON_ERROR_STOP on
-- Após COMMIT em A e erro esperado + ROLLBACK em B.
begin read only;
set local role uniguacu_owner;
select set_config('uniguacu.test.expected_admin', :'expected_admin', true);
do $$ begin
  if (select count(*) from public.operator_access where active and role = 'admin') <> 1
    or not exists (select 1 from public.operator_access where active and role = 'admin'
      and user_id = current_setting('uniguacu.test.expected_admin')::uuid)
    or not exists (select 1 from uniguacu_private.access_control where bootstrapped) then
    raise exception 'FALHA: invariante final de administrador/bootstrap';
  end if;
end $$;
commit;