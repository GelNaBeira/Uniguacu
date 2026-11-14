-- Marco 6 / etapa 1. Aplicar como postgres após 0011, em ambiente autorizado.
begin;
set local lock_timeout = '5s';

create function private.valid_user_access(p_access jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(p_access) <> 'object' or p_access is null then false else
    p_access -> 'version' = '1'::jsonb
    and (select count(*) from jsonb_object_keys(p_access)) = 11
    and not exists (select 1 from jsonb_each(p_access) e where e.key <> 'version' and
      (e.key <> all(array['can_read_inventory','can_manage_catalogs','can_manage_products',
       'can_manage_keys','can_manage_cars','can_lend','can_return','can_delete','can_view_reports','can_view_all_lends'])
       or jsonb_typeof(e.value) <> 'boolean')) end;
$$;

-- Serializa mudanças de autorização e impede remover o último ADMIN ativo.
create function private.guard_user_authorization()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(6012001);
  if old.is_active and old.role = 'ADMIN' and (not new.is_active or new.role <> 'ADMIN')
    and not exists (select 1 from public.usuarios where id <> old.id and is_active and role = 'ADMIN') then
    raise exception 'Último administrador ativo' using errcode = '23514';
  end if;
  return new;
end; $$;
create trigger usuarios_guard_authorization before update of role, is_active on public.usuarios
for each row execute function private.guard_user_authorization();

create function public.admin_user_gate()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
end; $$;

-- A criação Auth e o perfil são atômicos: falhar o trigger reverte a criação Auth.
-- Somente app_metadata, escrito pelo Auth Admin, pode transportar a intenção de provisionamento.
create or replace function private.create_user_profile()
returns trigger language plpgsql security definer set search_path = '' as $$
declare intent jsonb := new.raw_app_meta_data -> 'provisioning'; actor uuid;
begin
  if new.raw_user_meta_data ->> 'name' is not null and
    length(btrim(new.raw_user_meta_data ->> 'name')) not between 2 and 120 then
    raise exception 'Nome inválido' using errcode = '23514'; end if;
  if intent is not null then
    actor := (intent ->> 'actor_id')::uuid;
    perform pg_advisory_xact_lock(6012001);
    perform 1 from public.usuarios where id = actor and is_active and role = 'ADMIN' for share;
    if not found then raise exception 'Administrador inválido' using errcode = '42501'; end if;
    if (intent ->> 'role') is null or (intent ->> 'role') not in ('ADMIN','USER')
      or private.valid_user_access(intent -> 'limited_access') is not true then
      raise exception 'Permissões inválidas' using errcode = '23514';
    end if;
    insert into public.usuarios(id,email,name,role,limited_access)
    values (new.id,new.email,btrim(new.raw_user_meta_data ->> 'name'),
      (intent ->> 'role')::public.user_role,intent -> 'limited_access');
  else
    -- Provisionamento externo permanece sem privilégios implícitos.
    insert into public.usuarios(id,email,name,role,limited_access)
    values (new.id,new.email,coalesce(nullif(btrim(new.raw_user_meta_data ->> 'name'),''),new.email),'USER','{}'::jsonb);
  end if;
  return new;
end; $$;

create function public.admin_update_user_access(p_id uuid, p_role public.user_role, p_access jsonb)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(6012001);
  if not private.is_admin() then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if p_role is null or private.valid_user_access(p_access) is not true then
    raise exception 'Permissões inválidas' using errcode = '23514'; end if;
  update public.usuarios set role = p_role, limited_access = p_access where id = p_id;
  if not found then raise exception 'Usuário inexistente' using errcode = 'P0002'; end if;
end; $$;

create function public.update_my_profile(p_name text, p_photo text default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_name is null or length(btrim(p_name)) not between 2 and 120 then
    raise exception 'Nome inválido' using errcode = '23514'; end if;
  if p_photo is not null and (p_photo !~ ('^' || auth.uid()::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
    or not exists (select 1 from storage.objects where bucket_id = 'profile-images' and name = p_photo)) then
    raise exception 'Foto inválida' using errcode = '23514'; end if;
  update public.usuarios set name = btrim(p_name), photo_url = coalesce(p_photo,photo_url)
    where id = auth.uid() and is_active;
  if not found then raise exception 'Acesso negado' using errcode = '42501'; end if;
end; $$;

create function public.deactivate_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(6012001);
  update public.usuarios set is_active = false where id = auth.uid() and is_active;
  if not found then raise exception 'Acesso negado' using errcode = '42501'; end if;
end; $$;

revoke all on function private.valid_user_access(jsonb), private.guard_user_authorization() from public, anon, authenticated;
revoke all on function public.admin_user_gate(), public.admin_update_user_access(uuid,public.user_role,jsonb),
  public.update_my_profile(text,text), public.deactivate_my_account() from public, anon, authenticated;
grant execute on function public.admin_user_gate(), public.admin_update_user_access(uuid,public.user_role,jsonb),
  public.update_my_profile(text,text), public.deactivate_my_account() to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('profile-images','profile-images',false,3145728,array['image/jpeg','image/png','image/webp']);
create policy profile_images_select on storage.objects for select to authenticated using (
  bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.usuarios where id = auth.uid() and is_active));
create policy profile_images_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.usuarios where id = auth.uid() and is_active));
create policy profile_images_delete on storage.objects for delete to authenticated using (
  bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text
  and exists (select 1 from public.usuarios where id = auth.uid() and is_active)
  and not exists (select 1 from public.usuarios u where u.id = auth.uid() and u.photo_url = storage.objects.name));
commit;