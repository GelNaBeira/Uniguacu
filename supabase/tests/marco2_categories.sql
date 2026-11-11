\set ON_ERROR_STOP on
-- Somente banco Supabase isolado. Como postgres, após 0001–0004. Rollback de fixtures.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('20000000-0000-4000-8000-000000000001','m2-user@example.invalid','{}'),
 ('20000000-0000-4000-8000-000000000002','m2-admin@example.invalid','{}');
update public.usuarios set role = 'ADMIN' where id = '20000000-0000-4000-8000-000000000002';
insert into public.categories(id,name) values ('20000000-0000-4000-8000-000000000003','M2 fixture');
insert into public.products(name,category_id) values ('M2 produto fixture','20000000-0000-4000-8000-000000000003');

set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $$
declare affected integer;
begin
  insert into public.categories(name) values ('M2 nova');
  update public.categories set name = 'M2 editada' where name = 'M2 nova';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'USER autorizado não editou'; end if;
  delete from public.categories where name = 'M2 editada';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'USER sem flag excluiu'; end if;
  begin
    insert into public.categories(name) values ('M2 editada');
    raise exception 'Duplicidade permitida';
  exception when unique_violation then null; end;
  begin
    insert into public.categories(name) values ('   ');
    raise exception 'Nome vazio permitido';
  exception when check_violation then null; end;
  begin
    update public.categories set id = '20000000-0000-4000-8000-000000000099' where name = 'M2 editada';
    raise exception 'ID protegido alterado';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
update public.usuarios set limited_access = jsonb_set(limited_access,'{can_delete}','true')
where id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
declare affected integer;
begin
  delete from public.categories where name = 'M2 editada';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'USER com flag não excluiu'; end if;
  begin
    delete from public.categories where id = '20000000-0000-4000-8000-000000000003';
    raise exception 'Categoria referenciada excluída';
  exception when foreign_key_violation then null; end;
end; $$;
reset role;
update public.usuarios set limited_access = '{"version":1,"can_read_inventory":true}'
where id = '20000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  begin
    insert into public.categories(name) values ('M2 negada');
    raise exception 'Sem can_manage_catalogs criou';
  exception when insufficient_privilege then null; end;
end; $$;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000002',true);
insert into public.categories(name) values ('M2 admin');
update public.categories set name = 'M2 admin editada' where name = 'M2 admin';
delete from public.categories where name = 'M2 admin editada';
reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.categories;
    raise exception 'anon acessou categories';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;