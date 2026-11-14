-- Aplicar após 0010, em ambiente autorizado. Não reclassifica o histórico.
begin;
set local lock_timeout = '5s';

alter table public.products add column is_consumable boolean not null default false;
grant insert (is_consumable), update (is_consumable) on public.products to authenticated;
alter table public.academics add column phone text;
grant insert (phone), update (phone) on public.academics to authenticated;

alter table public.lendies drop constraint lendies_rpc_contract;
alter table public.lendies add constraint lendies_rpc_contract check (request_id is null or
  (((collaborator_id is not null) <> (academic_id is not null)) and created_by is not null
    and out_at is not null and status is not null and returned_quantity is not null
    and ((no_return is true and status = 'SEM_DEVOLUCAO' and returned_at is null and returned_quantity = 0)
      or (no_return is false and
        ((status = 'DEVOLVIDO' and returned_at is not null and returned_quantity = quantity)
          or (status in ('EM_ANDAMENTO','ATRASADO') and returned_at is null and returned_quantity = 0)))))) not valid;

-- Entradas são auditadas em operations, sem liberar UPDATE de qtd ao cliente.
create function public.add_product_stock(p_product_id uuid, p_quantity integer, p_date date, p_note text, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid(); resource public.products%rowtype; previous public.operations%rowtype; result uuid;
  payload jsonb := jsonb_build_object('product_id',p_product_id,'quantity',p_quantity,'date',p_date,'note',p_note);
begin
  if actor is null then raise exception 'Operação não autorizada.' using errcode = '42501'; end if;
  perform 1 from public.usuarios where id = actor for share;
  if not found or not (private.is_admin() or
    (private.has_permission('can_read_inventory') and private.has_permission('can_manage_products'))) then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;
  if p_product_id is null or p_quantity is null or p_quantity <= 0 or p_date is null
    or not isfinite(p_date) or p_note is null or length(p_note) > 2000 or p_request_id is null then
    raise exception 'Entrada inválida.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text || ':' || p_request_id::text, 0));
  select * into previous from public.operations where user_id = actor and request_id = p_request_id;
  if found then
    if previous.operation_type is distinct from 'PRODUCT_STOCK_ENTRY' or previous.details -> 'request' is distinct from payload then
      raise exception 'Requisição já utilizada com outros dados.' using errcode = '22023';
    end if;
    return previous.id;
  end if;
  select * into resource from public.products where id = p_product_id for update;
  if not found then raise exception 'Produto não encontrado.' using errcode = 'P0002'; end if;
  update public.products set qtd = qtd + p_quantity where id = p_product_id;
  insert into public.operations(operation_type,user_id,request_id,description,details)
    values ('PRODUCT_STOCK_ENTRY',actor,p_request_id,'Entrada de estoque',
      jsonb_build_object('request',payload,'name',resource.name,'previous_quantity',resource.qtd,'quantity',p_quantity))
    returning id into result;
  return result;
end; $$;
alter function public.add_product_stock(uuid,integer,date,text,uuid) owner to postgres;
revoke all on function public.add_product_stock(uuid,integer,date,text,uuid) from public, anon, authenticated;
grant execute on function public.add_product_stock(uuid,integer,date,text,uuid) to authenticated;

create or replace function public.lend_product(p_product_id uuid, p_quantity integer, p_collaborator_id uuid, p_request_id uuid, p_academic_id uuid default null)
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
      (moment at time zone 'UTC')::time,moment,resource.is_consumable,case when resource.is_consumable then 'SEM_DEVOLUCAO'::public.lend_status else 'EM_ANDAMENTO'::public.lend_status end,actor,p_request_id,0)
    returning id into result;
  insert into public.operations(operation_type,user_id,lend_id,request_id,description,details)
    values ('PRODUCT_LEND',actor,result,p_request_id,'Empréstimo de produto',
      jsonb_build_object('request',payload,'name',resource.name,'quantity',p_quantity,'is_consumable',resource.is_consumable));
  update public.products set qtd = qtd - p_quantity where id = p_product_id;
  return result;
end; $$;


alter function public.lend_product(uuid,integer,uuid,uuid,uuid) owner to postgres;
revoke all on function public.lend_product(uuid,integer,uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.lend_product(uuid,integer,uuid,uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
