-- Acadêmicos como destinatários exclusivos; preserva RLS e histórico.
-- O CHECK validado aborta se houver legado sem destinatário; não inventa vínculos.
begin;
set local lock_timeout = '5s';

alter table public.lendies add column academic_id uuid references public.academics(id);
create index lendies_academic_id_idx on public.lendies(academic_id);
alter table public.lendies add constraint lendies_recipient_check
  check ((collaborator_id is not null) <> (academic_id is not null));
alter table public.lendies drop constraint lendies_rpc_contract;
alter table public.lendies add constraint lendies_rpc_contract check (request_id is null or
  (((collaborator_id is not null) <> (academic_id is not null)) and created_by is not null and out_at is not null
    and no_return is false and returned_quantity is not null
    and ((status = 'DEVOLVIDO' and returned_at is not null and returned_quantity = quantity)
      or (status in ('EM_ANDAMENTO','ATRASADO') and returned_at is null and returned_quantity = 0))
    and status is not null)) not valid;

alter table public.key_lends add column academic_id uuid references public.academics(id);
create index key_lends_academic_id_idx on public.key_lends(academic_id);
alter table public.key_lends add constraint key_lends_recipient_check
  check ((collaborator_id is not null) <> (academic_id is not null));
alter table public.key_lends drop constraint key_lends_rpc_contract;
alter table public.key_lends add constraint key_lends_rpc_contract check (request_id is null or
  (((collaborator_id is not null) <> (academic_id is not null)) and created_by is not null and out_at is not null and status is not null
    and ((status = 'DEVOLVIDO' and returned_at is not null)
      or (status in ('EM_ANDAMENTO','ATRASADO') and returned_at is null)))) not valid;

alter table public.car_key_lends add column academic_id uuid references public.academics(id);
create index car_key_lends_academic_id_idx on public.car_key_lends(academic_id);
alter table public.car_key_lends add constraint car_key_lends_recipient_check
  check ((collaborator_id is not null) <> (academic_id is not null));
alter table public.car_key_lends drop constraint car_key_lends_rpc_contract;
alter table public.car_key_lends add constraint car_key_lends_rpc_contract check (request_id is null or
  (((collaborator_id is not null) <> (academic_id is not null)) and created_by is not null and out_at is not null and status is not null
    and km_out is not null and km_out >= 0
    and ((status = 'DEVOLVIDO' and returned_at is not null and km_in is not null and km_in >= km_out)
      or (status in ('EM_ANDAMENTO','ATRASADO') and returned_at is null and km_in is null)))) not valid;

-- Remover assinaturas antigas evita sobrecarga ambígua no PostgREST.
-- Parâmetro final opcional preserva chamadas SQL/RPC antigas de colaboradores.
drop function public.lend_product(uuid,integer,uuid,uuid);
drop function public.lend_key(uuid,uuid,uuid);
drop function public.lend_car(uuid,uuid,integer,uuid);

create function public.lend_product(p_product_id uuid, p_quantity integer, p_collaborator_id uuid, p_request_id uuid, p_academic_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; resource public.products%rowtype; result uuid; moment timestamptz;
  payload jsonb := jsonb_build_object('product_id',p_product_id,'quantity',p_quantity,'collaborator_id',p_collaborator_id) || case when p_academic_id is null then '{}'::jsonb else jsonb_build_object('academic_id',p_academic_id) end;
begin
  actor := private.lending_actor('can_lend');
  if p_product_id is null or ((p_collaborator_id is null) = (p_academic_id is null)) or p_quantity is null or p_quantity <= 0 then
    raise exception 'Produto, destinatário e quantidade positiva são obrigatórios.' using errcode = '22023';
  end if;
  result := private.lending_retry(p_request_id,'PRODUCT_LEND',payload);
  if result is not null then return result; end if;
  select * into resource from public.products where id = p_product_id for update;
  if not found then raise exception 'Produto não encontrado.' using errcode = 'P0002'; end if;
  if resource.qtd < p_quantity then raise exception 'Estoque insuficiente.' using errcode = '23514'; end if;
  if p_academic_id is not null then
    perform 1 from public.academics where id = p_academic_id for key share;
  else
    perform 1 from public.collaborators where id = p_collaborator_id for key share;
  end if;
  if not found then raise exception 'Destinatário não encontrado.' using errcode = '23503'; end if;
  moment := clock_timestamp();
  insert into public.lendies(product_id,collaborator_id,academic_id,quantity,out_date,out_time,out_at,
    no_return,status,created_by,request_id,returned_quantity)
    values (p_product_id,p_collaborator_id,p_academic_id,p_quantity,(moment at time zone 'UTC')::date,
      (moment at time zone 'UTC')::time,moment,false,'EM_ANDAMENTO',actor,p_request_id,0)
    returning id into result;
  insert into public.operations(operation_type,user_id,lend_id,request_id,description,details)
    values ('PRODUCT_LEND',actor,result,p_request_id,'Empréstimo de produto',
      jsonb_build_object('request',payload,'name',resource.name,'quantity',p_quantity));
  update public.products set qtd = qtd - p_quantity where id = p_product_id;
  return result;
end; $$;

create function public.lend_key(p_key_id uuid, p_collaborator_id uuid, p_request_id uuid, p_academic_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; resource public.keys%rowtype; result uuid; moment timestamptz;
  payload jsonb := jsonb_build_object('key_id',p_key_id,'collaborator_id',p_collaborator_id) || case when p_academic_id is null then '{}'::jsonb else jsonb_build_object('academic_id',p_academic_id) end;
begin
  actor := private.lending_actor('can_lend');
  if p_key_id is null or ((p_collaborator_id is null) = (p_academic_id is null)) then
    raise exception 'Chave e destinatário são obrigatórios.' using errcode = '22023';
  end if;
  result := private.lending_retry(p_request_id,'KEY_LEND',payload);
  if result is not null then return result; end if;
  select * into resource from public.keys where id = p_key_id for update;
  if not found then raise exception 'Chave não encontrada.' using errcode = 'P0002'; end if;
  if resource.status <> 'DISPONIVEL' or exists (select 1 from public.key_lends
    where key_id = p_key_id and status in ('EM_ANDAMENTO','ATRASADO')) then
    raise exception 'Chave indisponível.' using errcode = '23514';
  end if;
  if p_academic_id is not null then
    perform 1 from public.academics where id = p_academic_id for key share;
  else
    perform 1 from public.collaborators where id = p_collaborator_id for key share;
  end if;
  if not found then raise exception 'Destinatário não encontrado.' using errcode = '23503'; end if;
  moment := clock_timestamp();
  insert into public.key_lends(key_id,collaborator_id,academic_id,out_date,out_at,status,created_by,request_id)
    values (p_key_id,p_collaborator_id,p_academic_id,(moment at time zone 'UTC')::date,moment,'EM_ANDAMENTO',actor,p_request_id)
    returning id into result;
  insert into public.operations(operation_type,user_id,key_lend_id,request_id,description,details)
    values ('KEY_LEND',actor,result,p_request_id,'Empréstimo de chave',jsonb_build_object('request',payload,'name',resource.name));
  update public.keys set status = 'INDISPONIVEL' where id = p_key_id;
  return result;
end; $$;

create function public.lend_car(p_car_id uuid, p_collaborator_id uuid, p_km_out integer, p_request_id uuid, p_academic_id uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; resource public.car_keys%rowtype; result uuid; moment timestamptz;
  payload jsonb := jsonb_build_object('car_id',p_car_id,'collaborator_id',p_collaborator_id,'km_out',p_km_out) || case when p_academic_id is null then '{}'::jsonb else jsonb_build_object('academic_id',p_academic_id) end;
begin
  actor := private.lending_actor('can_lend');
  if p_car_id is null or ((p_collaborator_id is null) = (p_academic_id is null)) or p_km_out is null or p_km_out < 0 then
    raise exception 'Carro, destinatário e odômetro não negativo são obrigatórios.' using errcode = '22023';
  end if;
  result := private.lending_retry(p_request_id,'CAR_LEND',payload);
  if result is not null then return result; end if;
  select * into resource from public.car_keys where id = p_car_id for update;
  if not found then raise exception 'Carro não encontrado.' using errcode = 'P0002'; end if;
  if resource.status <> 'DISPONIVEL' or exists (select 1 from public.car_key_lends
    where car_key_id = p_car_id and status in ('EM_ANDAMENTO','ATRASADO')) then
    raise exception 'Carro indisponível.' using errcode = '23514';
  end if;
  if resource.mileage is not null and p_km_out < resource.mileage then
    raise exception 'Retirada inferior ao odômetro cadastrado.' using errcode = '23514';
  end if;
  if p_academic_id is not null then
    perform 1 from public.academics where id = p_academic_id for key share;
  else
    perform 1 from public.collaborators where id = p_collaborator_id for key share;
  end if;
  if not found then raise exception 'Destinatário não encontrado.' using errcode = '23503'; end if;
  moment := clock_timestamp();
  insert into public.car_key_lends(car_key_id,collaborator_id,academic_id,km_out,out_date,out_at,status,created_by,request_id)
    values (p_car_id,p_collaborator_id,p_academic_id,p_km_out,(moment at time zone 'UTC')::date,moment,'EM_ANDAMENTO',actor,p_request_id)
    returning id into result;
  insert into public.operations(operation_type,user_id,car_key_lend_id,request_id,description,details)
    values ('CAR_LEND',actor,result,p_request_id,'Empréstimo de carro',jsonb_build_object('request',payload,'name',resource.name));
  update public.car_keys set status = 'INDISPONIVEL' where id = p_car_id;
  return result;
end; $$;

alter function public.lend_product(uuid,integer,uuid,uuid,uuid) owner to postgres;
alter function public.lend_key(uuid,uuid,uuid,uuid) owner to postgres;
alter function public.lend_car(uuid,uuid,integer,uuid,uuid) owner to postgres;
revoke all on function public.lend_product(uuid,integer,uuid,uuid,uuid),
  public.lend_key(uuid,uuid,uuid,uuid), public.lend_car(uuid,uuid,integer,uuid,uuid) from public, anon, authenticated;
grant execute on function public.lend_product(uuid,integer,uuid,uuid,uuid),
  public.lend_key(uuid,uuid,uuid,uuid), public.lend_car(uuid,uuid,integer,uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
