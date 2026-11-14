\set ON_ERROR_STOP on
-- Somente banco isolado após 0013. Fixtures fictícias e rollback.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('a1300000-0000-4000-8000-000000000001','deactivation-admin1@example.invalid','{}'),
 ('a1300000-0000-4000-8000-000000000002','deactivation-admin2@example.invalid','{}'),
 ('a1300000-0000-4000-8000-000000000003','deactivation-user@example.invalid','{}');
update public.usuarios set role = 'ADMIN' where id in
 ('a1300000-0000-4000-8000-000000000001','a1300000-0000-4000-8000-000000000002');

set local role authenticated;
select set_config('request.jwt.claim.sub','a1300000-0000-4000-8000-000000000003',true);
do $$ begin
  begin
    perform public.admin_deactivate_user('a1300000-0000-4000-8000-000000000003');
    raise exception 'USER inativou a si mesmo';
  exception when insufficient_privilege then null; end;
  begin
    perform public.admin_deactivate_user('a1300000-0000-4000-8000-000000000002');
    raise exception 'USER inativou terceiro';
  exception when insufficient_privilege then null; end;
  begin
    perform public.deactivate_my_account();
    raise exception 'RPC antiga permitiu auto-inativação';
  exception when insufficient_privilege then null; end;
end; $$;

select set_config('request.jwt.claim.sub','a1300000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform public.admin_deactivate_user('a1300000-0000-4000-8000-000000000001');
    raise exception 'ADMIN inativou a si mesmo com outro ADMIN ativo';
  exception when insufficient_privilege then null; end;
  begin
    perform public.deactivate_my_account();
    raise exception 'ADMIN acessou RPC antiga';
  exception when insufficient_privilege then null; end;
end; $$;
-- Superusuário com JWT do ADMIN: testa o trigger mesmo sem a barreira de grants/RLS.
reset role;
do $$ begin
  begin
    update public.usuarios set is_active = false where id = auth.uid();
    raise exception 'Trigger permitiu auto-inativação';
  exception when insufficient_privilege then null; end;
end; $$;
set local role authenticated;
select public.admin_deactivate_user('a1300000-0000-4000-8000-000000000003');
select public.admin_deactivate_user('a1300000-0000-4000-8000-000000000002');
do $$ begin
  if (select count(*) from public.usuarios where id::text like 'a1300000-%') <> 3 then
    raise exception 'Histórico de contas removido'; end if;
  if exists (select 1 from public.usuarios where id in
    ('a1300000-0000-4000-8000-000000000002','a1300000-0000-4000-8000-000000000003') and is_active) then
    raise exception 'ADMIN não inativou terceiros'; end if;
  begin
    update public.usuarios set is_active = false where id = auth.uid();
    raise exception 'UPDATE direto permitido';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','a1300000-0000-4000-8000-000000000002',true);
do $$ begin
  begin
    perform public.admin_deactivate_user('a1300000-0000-4000-8000-000000000001');
    raise exception 'ADMIN inativo inativou terceiro';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select set_config('request.jwt.claim.sub','a1300000-0000-4000-8000-000000000001',true);
-- Isola também dos ADMIN preexistentes na base de homologação (rollback ao final).
update public.usuarios set role = 'USER' where role = 'ADMIN' and id <> auth.uid();
do $$ begin
  begin
    update public.usuarios set is_active = false where id = auth.uid();
    raise exception 'Último ADMIN inativado';
  exception when check_violation then null; end;
  begin
    update public.usuarios set role = 'USER' where id = auth.uid();
    raise exception 'Último ADMIN rebaixado';
  exception when check_violation then null; end;
  if has_function_privilege('anon','public.admin_deactivate_user(uuid)','EXECUTE')
    or has_function_privilege('authenticated','public.deactivate_my_account()','EXECUTE') then
    raise exception 'Grants inseguros'; end if;
end; $$;
rollback;