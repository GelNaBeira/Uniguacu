-- Somente em ambiente isolado após confronto com o catálogo remoto.
begin;

-- Soft delete: nenhuma API do MVP recebe escrita direta nesta coluna.
alter table public.usuarios add column is_active boolean not null default true;

-- Sem operador conhecido, o histórico legado não é atribuído artificialmente.
alter table public.lendies add column created_by uuid references public.usuarios(id);
alter table public.key_lends add column created_by uuid references public.usuarios(id);
alter table public.car_key_lends add column created_by uuid references public.usuarios(id);

-- Não remover/recriar distance antes de inventariar dependências remotas (D09).
-- Fórmula aprovada será aplicada no marco de Carro após preflight próprio.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create function private.prevent_account_delete()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Exclusão física bloqueada. Utilize Inativar Conta.' using errcode = '23514';
end;
$$;
revoke all on function private.prevent_account_delete() from public, anon, authenticated;
-- Também protege o cascade de auth.users. Sem rotina de exclusão física no MVP.
create trigger usuarios_prevent_delete before delete on public.usuarios
for each row execute function private.prevent_account_delete();

create function private.create_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios(id, email, name, role, limited_access)
  values (new.id, new.email, coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), new.email), 'USER',
    '{"version":1,"can_read_inventory":true,"can_manage_catalogs":true,"can_manage_products":true,"can_manage_keys":true,"can_manage_cars":true,"can_lend":true,"can_return":true,"can_delete":false,"can_view_reports":false,"can_view_all_lends":false}'::jsonb);
  return new;
end;
$$;
alter function private.create_user_profile() owner to postgres;
revoke all on function private.create_user_profile() from public, anon, authenticated;
-- Signup público DEVE estar desabilitado no painel Auth antes do deploy.
create trigger on_auth_user_created after insert on auth.users
for each row execute function private.create_user_profile();

commit;