-- Aplicar após 0012 em ambiente autorizado. Preserva contas e histórico.
begin;
set local lock_timeout = '5s';

create or replace function private.guard_user_authorization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(6012001);
  if old.is_active and old.role = 'ADMIN' and (not new.is_active or new.role <> 'ADMIN')
    and not exists (select 1 from public.usuarios where id <> old.id and is_active and role = 'ADMIN') then
    raise exception 'Último administrador ativo' using errcode = '23514';
  end if;
  if old.is_active and not new.is_active then
    if auth.uid() is null or auth.uid() = old.id or not private.is_admin() then
      raise exception 'Somente ADMIN pode inativar outra pessoa' using errcode = '42501';
    end if;
  end if;
  return new;
end; $$;

-- Clientes antigos também recebem rejeição explícita: não há auto-inativação.
create or replace function public.deactivate_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  raise exception 'Não é permitido inativar a própria conta' using errcode = '42501';
end; $$;
revoke all on function public.deactivate_my_account() from public, anon, authenticated;

create function public.admin_deactivate_user(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(6012001);
  if not private.is_admin() or auth.uid() is null or p_id is null or auth.uid() = p_id then
    raise exception 'Somente ADMIN pode inativar outra pessoa' using errcode = '42501';
  end if;
  update public.usuarios set is_active = false where id = p_id and is_active;
  if not found then raise exception 'Usuário inexistente ou já inativo' using errcode = 'P0002'; end if;
end; $$;
revoke all on function public.admin_deactivate_user(uuid) from public, anon, authenticated;
grant execute on function public.admin_deactivate_user(uuid) to authenticated;
commit;