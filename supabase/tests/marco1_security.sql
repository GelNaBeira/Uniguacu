\set ON_ERROR_STOP on
-- Executar APENAS em Supabase isolado, como postgres, após 0001–0003.
-- Fixtures fictícias, rollback ao final. Não substitui testes pela API Auth.
begin;
do $$
begin
  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relrowsecurity and c.relname = any(array[
    'usuarios','categories','sectors','suppliers','collaborators','academics','products',
    'keys','car_keys','lendies','key_lends','car_key_lends','operations'])) <> 13 then
    raise exception 'RLS ausente em tabela de domínio';
  end if;
  if has_function_privilege('anon', 'private.is_admin()', 'EXECUTE') then
    raise exception 'anon executa helper';
  end if;
  if has_table_privilege('authenticated', 'public.usuarios', 'UPDATE')
    or has_column_privilege('authenticated', 'public.products', 'qtd', 'UPDATE') then
    raise exception 'Escrita direta sensível liberada';
  end if;
end;
$$;

insert into auth.users(id, email, raw_user_meta_data) values
 ('10000000-0000-4000-8000-000000000001', 'm1-user@example.invalid', '{"role":"ADMIN"}'),
 ('10000000-0000-4000-8000-000000000002', 'm1-admin@example.invalid', '{}');
update public.usuarios set role = 'ADMIN' where id = '10000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000001', true);
do $$
begin
  if private.is_admin() then raise exception 'Metadata elevou USER'; end if;
  if not private.has_permission('can_read_inventory') then raise exception 'Default USER inválido'; end if;
  if private.has_permission('can_delete') or private.has_permission('desconhecida') then
    raise exception 'Flag restrita concedida';
  end if;
  if (select count(*) from public.usuarios) <> 1 then raise exception 'Perfil alheio visível'; end if;
  begin
    update public.usuarios set role = 'ADMIN' where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Autoelevação permitida';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
update public.usuarios set limited_access = '{"version":1,"can_read_inventory":"true"}' where id = '10000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  if private.has_permission('can_read_inventory') then raise exception 'String aceita como boolean'; end if;
end; $$;
reset role;
update public.usuarios set is_active = false where id = '10000000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-4000-8000-000000000002', true);
do $$ begin
  if private.is_admin() then raise exception 'ADMIN inativo autorizado'; end if;
end; $$;
reset role;
do $$ begin
  begin
    delete from public.usuarios where id = '10000000-0000-4000-8000-000000000001';
    raise exception 'Exclusão física permitida';
  exception when check_violation then null;
  end;
end; $$;
rollback;