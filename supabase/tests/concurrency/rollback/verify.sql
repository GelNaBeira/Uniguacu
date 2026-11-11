\set ON_ERROR_STOP on
begin read only;
set local role uniguacu_owner;
do $$ begin
  if exists(select 1 from public.operator_access) or exists(select 1 from public.administrative_audit)
    or not exists(select 1 from uniguacu_private.access_control where singleton and not bootstrapped) then
    raise exception 'FALHA: rollback concorrente deixou estado persistente';
  end if;
end $$;
rollback;