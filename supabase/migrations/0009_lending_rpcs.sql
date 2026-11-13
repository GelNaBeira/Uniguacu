-- Marco 5 / etapa 1. Pré-requisitos: 0001–0008 homologadas; NÃO executar 0006a.
-- Aplicar INTEIRO como postgres em homologação, com backup e janela de manutenção.
-- Não idempotente: objetos/policies inesperados abortam, sem saneamento automático.
begin;
set local lock_timeout = '5s';
-- Sem LOCK TABLE global: o DDL adquire seus locks implicitamente.
-- BEGIN/COMMIT mantém atomicidade; FOR UPDATE nas RPCs mantém a concorrência.
-- Executar como postgres/owner autorizado, não como authenticated/anon.

do $$
declare t text;
begin
  foreach t in array array['lendies','key_lends','car_key_lends','operations'] loop
    if (select count(*) from pg_policies where schemaname = 'public' and tablename = t) <> 1
      or not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t
        and policyname = t || '_select' and cmd = 'SELECT'
        and roles = array['authenticated']::name[]) then
      raise exception 'Policies inesperadas em %. Revisar catálogo antes da 0009.', t;
    end if;
  end loop;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(array[
      'lend_product','return_product','lend_key','return_key','lend_car','return_car'])) then
    raise exception 'RPC de empréstimo já existente; revisar assinaturas antes da 0009.';
  end if;
  if exists (select 1 from public.key_lends where status in ('EM_ANDAMENTO','ATRASADO')
    group by key_id having count(*) > 1)
    or exists (select 1 from public.car_key_lends where status in ('EM_ANDAMENTO','ATRASADO')
      group by car_key_id having count(*) > 1) then
    raise exception 'Empréstimos ativos duplicados no legado; reconciliar sem apagar histórico.';
  end if;
end; $$;

-- Sem backfill de destinatário, operador ou data efetiva de registros históricos.
alter table public.lendies add column out_at timestamptz,
  add column returned_at timestamptz, add column request_id uuid,
  add column returned_quantity integer;
alter table public.key_lends add column out_at timestamptz,
  add column returned_at timestamptz, add column request_id uuid;
alter table public.car_key_lends add column out_at timestamptz,
  add column returned_at timestamptz, add column request_id uuid;
-- Regras dos NOVOS comandos sem inventar valores em registros legados.
alter table public.lendies add constraint lendies_rpc_contract check (request_id is null or
  (collaborator_id is not null and created_by is not null and out_at is not null
    and no_return is false and returned_quantity is not null
    and ((status = 'DEVOLVIDO' and returned_at is not null and returned_quantity = quantity)
      or (status in ('EM_ANDAMENTO','ATRASADO') and returned_at is null and returned_quantity = 0))
    and status is not null)) not valid;
alter table public.key_lends add constraint key_lends_rpc_contract check (request_id is null or
  (collaborator_id is not null and created_by is not null and out_at is not null and status is not null
    and ((status = 'DEVOLVIDO' and returned_at is not null)
      or (status in ('EM_ANDAMENTO','ATRASADO') and returned_at is null)))) not valid;
alter table public.car_key_lends add constraint car_key_lends_rpc_contract check (request_id is null or
  (collaborator_id is not null and created_by is not null and out_at is not null and status is not null
    and km_out is not null and km_out >= 0
    and ((status = 'DEVOLVIDO' and returned_at is not null and km_in is not null and km_in >= km_out)
      or (status in ('EM_ANDAMENTO','ATRASADO') and returned_at is null and km_in is null)))) not valid;
alter table public.operations add column lend_id uuid references public.lendies(id),
  add column key_lend_id uuid references public.key_lends(id),
  add column car_key_lend_id uuid references public.car_key_lends(id),
  add column request_id uuid, add column details jsonb;
alter table public.operations add constraint operations_one_lending_link
  check (num_nonnulls(lend_id,key_lend_id,car_key_lend_id) <= 1) not valid;
create unique index operations_lending_request_idx on public.operations(user_id,request_id)
  where request_id is not null;
create index operations_lend_id_idx on public.operations(lend_id);
create index operations_key_lend_id_idx on public.operations(key_lend_id);
create index operations_car_key_lend_id_idx on public.operations(car_key_lend_id);
create unique index key_lends_one_active_idx on public.key_lends(key_id)
  where status in ('EM_ANDAMENTO','ATRASADO');
create unique index car_key_lends_one_active_idx on public.car_key_lends(car_key_id)
  where status in ('EM_ANDAMENTO','ATRASADO');
create index lendies_product_id_idx on public.lendies(product_id);

-- Mantém leitura da matriz; nem ADMIN do app ganha DML direto ou por coluna.
do $$
declare t text; columns text;
begin
  foreach t in array array['lendies','key_lends','car_key_lends','operations'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', t);
    select string_agg(quote_ident(attname), ', ') into columns from pg_attribute
      where attrelid = format('public.%I',t)::regclass and attnum > 0 and not attisdropped;
    execute format('revoke all privileges (%s) on table public.%I from public, anon, authenticated', columns,t);
    execute format('grant select on table public.%I to authenticated', t);
    -- Defesa adicional para grants futuros: policies RESTRICTIVE de escrita negam tudo.
    execute format('create policy %I on public.%I as restrictive for insert to authenticated with check (false)',t || '_deny_insert',t);
    execute format('create policy %I on public.%I as restrictive for update to authenticated using (false) with check (false)',t || '_deny_update',t);
    execute format('create policy %I on public.%I as restrictive for delete to authenticated using (false)',t || '_deny_delete',t);
  end loop;
end; $$;

-- Helpers privados: somente as RPCs owner postgres podem executá-los.
-- FOR SHARE estabiliza o perfil durante a transação: revogação concorrente
-- espera sua conclusão; revogação já confirmada é observada antes da escrita.
create function private.lending_actor(p_action text, p_created_by uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
  if actor is null or p_action not in ('can_lend','can_return') or p_action is null then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;
  perform 1 from public.usuarios where id = actor for share;
  if not found or not (private.is_admin() or
    (private.has_permission('can_read_inventory') and private.has_permission(p_action))) then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;
  if p_action = 'can_return' and not private.is_admin()
    and p_created_by is distinct from actor and not private.has_permission('can_view_all_lends') then
    raise exception 'Operação não autorizada.' using errcode = '42501';
  end if;
  return actor;
end; $$;

-- Mutex por ator/requisição ANTES do recurso: retry concorrente e entre tipos
-- não consome duas vezes. UUID de requisição não permite trocar o payload.
create function private.lending_retry(p_request_id uuid, p_type text, p_payload jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare previous public.operations%rowtype;
begin
  if p_request_id is null then
    raise exception 'Informe o identificador da requisição.' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text || ':' || p_request_id::text, 0));
  select * into previous from public.operations
    where user_id = auth.uid() and request_id = p_request_id;
  if found then
    if previous.operation_type is distinct from p_type
      or previous.details -> 'request' is distinct from p_payload then
      raise exception 'Requisição já utilizada com outros dados.' using errcode = '22023';
    end if;
    return coalesce(previous.lend_id,previous.key_lend_id,previous.car_key_lend_id);
  end if;
  return null;
end; $$;

create function public.lend_product(p_product_id uuid, p_quantity integer, p_collaborator_id uuid, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; resource public.products%rowtype; result uuid; moment timestamptz;
  payload jsonb := jsonb_build_object('product_id',p_product_id,'quantity',p_quantity,'collaborator_id',p_collaborator_id);
begin
  actor := private.lending_actor('can_lend');
  if p_product_id is null or p_collaborator_id is null or p_quantity is null or p_quantity <= 0 then
    raise exception 'Produto, colaborador e quantidade positiva são obrigatórios.' using errcode = '22023';
  end if;
  result := private.lending_retry(p_request_id,'PRODUCT_LEND',payload);
  if result is not null then return result; end if;
  select * into resource from public.products where id = p_product_id for update;
  if not found then raise exception 'Produto não encontrado.' using errcode = 'P0002'; end if;
  if resource.qtd < p_quantity then raise exception 'Estoque insuficiente.' using errcode = '23514'; end if;
  perform 1 from public.collaborators where id = p_collaborator_id for key share;
  if not found then raise exception 'Colaborador não encontrado.' using errcode = '23503'; end if;
  moment := clock_timestamp();
  insert into public.lendies(product_id,collaborator_id,quantity,out_date,out_time,out_at,
    no_return,status,created_by,request_id,returned_quantity)
    values (p_product_id,p_collaborator_id,p_quantity,(moment at time zone 'UTC')::date,
      (moment at time zone 'UTC')::time,moment,false,'EM_ANDAMENTO',actor,p_request_id,0)
    returning id into result;
  insert into public.operations(operation_type,user_id,lend_id,request_id,description,details)
    values ('PRODUCT_LEND',actor,result,p_request_id,'Empréstimo de produto',
      jsonb_build_object('request',payload,'name',resource.name,'quantity',p_quantity));
  update public.products set qtd = qtd - p_quantity where id = p_product_id;
  return result;
end; $$;

create function public.return_product(p_lend_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; loan public.lendies%rowtype; resource public.products%rowtype; resource_id uuid;
begin
  -- Primeiro check de identidade/permissão sem expor existência de empréstimo.
  actor := private.lending_actor('can_return',auth.uid());
  select * into loan from public.lendies where id = p_lend_id;
  if not found then raise exception 'Empréstimo não encontrado.' using errcode = 'P0002'; end if;
  perform private.lending_actor('can_return',loan.created_by);
  resource_id := loan.product_id;
  select * into resource from public.products where id = resource_id for update;
  select * into loan from public.lendies where id = p_lend_id for update;
  perform private.lending_actor('can_return',loan.created_by);
  if loan.out_at is null or loan.request_id is null or loan.no_return is distinct from false then
    raise exception 'Empréstimo legado/sem devolução exige reconciliação.' using errcode = '23514';
  end if;
  if loan.status = 'DEVOLVIDO' and loan.returned_at is not null and loan.returned_quantity = loan.quantity then
    return loan.id;
  end if;
  if loan.status is null or loan.status not in ('EM_ANDAMENTO','ATRASADO')
    or loan.returned_at is not null or loan.returned_quantity is distinct from 0 then
    raise exception 'Estado não permite devolução integral.' using errcode = '23514';
  end if;
  update public.lendies set status = 'DEVOLVIDO', returned_at = clock_timestamp(),
    returned_quantity = quantity where id = loan.id;
  insert into public.operations(operation_type,user_id,lend_id,description,details)
    values ('PRODUCT_RETURN',actor,loan.id,'Devolução integral de produto',
      jsonb_build_object('product_id',resource_id,'name',resource.name,'quantity',loan.quantity));
  update public.products set qtd = qtd + loan.quantity where id = resource_id;
  return loan.id;
end; $$;

create function public.lend_key(p_key_id uuid, p_collaborator_id uuid, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; resource public.keys%rowtype; result uuid; moment timestamptz;
  payload jsonb := jsonb_build_object('key_id',p_key_id,'collaborator_id',p_collaborator_id);
begin
  actor := private.lending_actor('can_lend');
  if p_key_id is null or p_collaborator_id is null then
    raise exception 'Chave e colaborador são obrigatórios.' using errcode = '22023';
  end if;
  result := private.lending_retry(p_request_id,'KEY_LEND',payload);
  if result is not null then return result; end if;
  select * into resource from public.keys where id = p_key_id for update;
  if not found then raise exception 'Chave não encontrada.' using errcode = 'P0002'; end if;
  if resource.status <> 'DISPONIVEL' or exists (select 1 from public.key_lends
    where key_id = p_key_id and status in ('EM_ANDAMENTO','ATRASADO')) then
    raise exception 'Chave indisponível.' using errcode = '23514';
  end if;
  perform 1 from public.collaborators where id = p_collaborator_id for key share;
  if not found then raise exception 'Colaborador não encontrado.' using errcode = '23503'; end if;
  moment := clock_timestamp();
  insert into public.key_lends(key_id,collaborator_id,out_date,out_at,status,created_by,request_id)
    values (p_key_id,p_collaborator_id,(moment at time zone 'UTC')::date,moment,'EM_ANDAMENTO',actor,p_request_id)
    returning id into result;
  insert into public.operations(operation_type,user_id,key_lend_id,request_id,description,details)
    values ('KEY_LEND',actor,result,p_request_id,'Empréstimo de chave',jsonb_build_object('request',payload,'name',resource.name));
  update public.keys set status = 'INDISPONIVEL' where id = p_key_id;
  return result;
end; $$;

create function public.return_key(p_lend_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; loan public.key_lends%rowtype; resource public.keys%rowtype; resource_id uuid;
begin
  actor := private.lending_actor('can_return',auth.uid());
  select * into loan from public.key_lends where id = p_lend_id;
  if not found then raise exception 'Empréstimo não encontrado.' using errcode = 'P0002'; end if;
  perform private.lending_actor('can_return',loan.created_by);
  resource_id := loan.key_id;
  select * into resource from public.keys where id = resource_id for update;
  select * into loan from public.key_lends where id = p_lend_id for update;
  perform private.lending_actor('can_return',loan.created_by);
  if loan.out_at is null or loan.request_id is null then
    raise exception 'Empréstimo legado exige reconciliação.' using errcode = '23514';
  end if;
  if loan.status = 'DEVOLVIDO' and loan.returned_at is not null then return loan.id; end if;
  if loan.status is null or loan.status not in ('EM_ANDAMENTO','ATRASADO')
    or loan.returned_at is not null or resource.status <> 'INDISPONIVEL' then
    raise exception 'Estado não permite devolução.' using errcode = '23514';
  end if;
  update public.key_lends set status = 'DEVOLVIDO', returned_at = clock_timestamp() where id = loan.id;
  insert into public.operations(operation_type,user_id,key_lend_id,description,details)
    values ('KEY_RETURN',actor,loan.id,'Devolução de chave',jsonb_build_object('key_id',resource_id,'name',resource.name));
  update public.keys set status = 'DISPONIVEL' where id = resource_id;
  return loan.id;
end; $$;

create function public.lend_car(p_car_id uuid, p_collaborator_id uuid, p_km_out integer, p_request_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; resource public.car_keys%rowtype; result uuid; moment timestamptz;
  payload jsonb := jsonb_build_object('car_id',p_car_id,'collaborator_id',p_collaborator_id,'km_out',p_km_out);
begin
  actor := private.lending_actor('can_lend');
  if p_car_id is null or p_collaborator_id is null or p_km_out is null or p_km_out < 0 then
    raise exception 'Carro, colaborador e odômetro não negativo são obrigatórios.' using errcode = '22023';
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
  perform 1 from public.collaborators where id = p_collaborator_id for key share;
  if not found then raise exception 'Colaborador não encontrado.' using errcode = '23503'; end if;
  moment := clock_timestamp();
  insert into public.car_key_lends(car_key_id,collaborator_id,km_out,out_date,out_at,status,created_by,request_id)
    values (p_car_id,p_collaborator_id,p_km_out,(moment at time zone 'UTC')::date,moment,'EM_ANDAMENTO',actor,p_request_id)
    returning id into result;
  insert into public.operations(operation_type,user_id,car_key_lend_id,request_id,description,details)
    values ('CAR_LEND',actor,result,p_request_id,'Empréstimo de carro',jsonb_build_object('request',payload,'name',resource.name));
  update public.car_keys set status = 'INDISPONIVEL' where id = p_car_id;
  return result;
end; $$;

create function public.return_car(p_lend_id uuid, p_km_in integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare actor uuid; loan public.car_key_lends%rowtype; resource public.car_keys%rowtype; resource_id uuid;
begin
  actor := private.lending_actor('can_return',auth.uid());
  if p_km_in is null or p_km_in < 0 then
    raise exception 'Odômetro de devolução é obrigatório e não negativo.' using errcode = '22023';
  end if;
  select * into loan from public.car_key_lends where id = p_lend_id;
  if not found then raise exception 'Empréstimo não encontrado.' using errcode = 'P0002'; end if;
  perform private.lending_actor('can_return',loan.created_by);
  resource_id := loan.car_key_id;
  select * into resource from public.car_keys where id = resource_id for update;
  select * into loan from public.car_key_lends where id = p_lend_id for update;
  perform private.lending_actor('can_return',loan.created_by);
  if loan.out_at is null or loan.request_id is null or loan.km_out is null then
    raise exception 'Empréstimo legado exige reconciliação.' using errcode = '23514';
  end if;
  if loan.status = 'DEVOLVIDO' and loan.returned_at is not null then
    if loan.km_in is distinct from p_km_in then
      raise exception 'Devolução já registrada com outro odômetro.' using errcode = '22023';
    end if;
    return loan.id;
  end if;
  if loan.status is null or loan.status not in ('EM_ANDAMENTO','ATRASADO')
    or loan.returned_at is not null or loan.km_in is not null
    or resource.status <> 'INDISPONIVEL' or p_km_in < loan.km_out
    or (resource.mileage is not null and p_km_in < resource.mileage) then
    raise exception 'Estado ou odômetro não permite devolução.' using errcode = '23514';
  end if;
  -- distance é GENERATED STORED pela 0008: nunca enviada pelo cliente/RPC.
  update public.car_key_lends set km_in = p_km_in, status = 'DEVOLVIDO',
    returned_at = clock_timestamp() where id = loan.id;
  insert into public.operations(operation_type,user_id,car_key_lend_id,description,details)
    values ('CAR_RETURN',actor,loan.id,'Devolução de carro',
      jsonb_build_object('car_id',resource_id,'name',resource.name,'km_out',loan.km_out,'km_in',p_km_in,'distance',p_km_in - loan.km_out));
  update public.car_keys set mileage = p_km_in, status = 'DISPONIVEL' where id = resource_id;
  return loan.id;
end; $$;

-- Assinaturas explícitas: não conceder EXECUTE global em public/private.
alter function private.lending_actor(text,uuid) owner to postgres;
alter function private.lending_retry(uuid,text,jsonb) owner to postgres;
revoke all on function private.lending_actor(text,uuid), private.lending_retry(uuid,text,jsonb) from public, anon, authenticated;
alter function public.lend_product(uuid,integer,uuid,uuid) owner to postgres;
alter function public.return_product(uuid) owner to postgres;
alter function public.lend_key(uuid,uuid,uuid) owner to postgres;
alter function public.return_key(uuid) owner to postgres;
alter function public.lend_car(uuid,uuid,integer,uuid) owner to postgres;
alter function public.return_car(uuid,integer) owner to postgres;
revoke all on function public.lend_product(uuid,integer,uuid,uuid), public.return_product(uuid),
  public.lend_key(uuid,uuid,uuid), public.return_key(uuid),
  public.lend_car(uuid,uuid,integer,uuid), public.return_car(uuid,integer) from public, anon, authenticated;
grant execute on function public.lend_product(uuid,integer,uuid,uuid), public.return_product(uuid),
  public.lend_key(uuid,uuid,uuid), public.return_key(uuid),
  public.lend_car(uuid,uuid,integer,uuid), public.return_car(uuid,integer) to authenticated;

do $$
declare t text; role_name text; column_name text; signature text;
begin
  foreach t in array array['lendies','key_lends','car_key_lends','operations'] loop
    if not (select relrowsecurity from pg_class where oid = format('public.%I',t)::regclass)
      or (select count(*) from pg_policies where schemaname = 'public' and tablename = t) <> 4 then
      raise exception '0009: RLS/policies incompletas em %.',t;
    end if;
    foreach role_name in array array['anon','authenticated'] loop
      if has_table_privilege(role_name,format('public.%I',t),'INSERT,UPDATE,DELETE,TRUNCATE') then
        raise exception '0009: DML direto liberado em % para %.',t,role_name;
      end if;
      for column_name in select attname from pg_attribute
        where attrelid = format('public.%I',t)::regclass and attnum > 0 and not attisdropped loop
        if has_column_privilege(role_name,format('public.%I',t),column_name,'INSERT,UPDATE') then
          raise exception '0009: DML por coluna liberado em %.%.',t,column_name;
        end if;
      end loop;
    end loop;
  end loop;
  foreach signature in array array['lend_product(uuid,integer,uuid,uuid)','return_product(uuid)',
    'lend_key(uuid,uuid,uuid)','return_key(uuid)','lend_car(uuid,uuid,integer,uuid)','return_car(uuid,integer)'] loop
    if has_function_privilege('anon','public.' || signature,'EXECUTE')
      or not has_function_privilege('authenticated','public.' || signature,'EXECUTE')
      or not exists (select 1 from pg_proc where oid = ('public.' || signature)::regprocedure
        and prosecdef and pg_get_userbyid(proowner) = 'postgres' and proconfig = array['search_path=""']) then
      raise exception '0009: RPC insegura/incompleta: %.',signature;
    end if;
  end loop;
end; $$;
commit;