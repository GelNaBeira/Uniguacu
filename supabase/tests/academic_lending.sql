-- Executar como postgres; fixtures e operações são integralmente revertidas.
begin;
set local lock_timeout = '5s';
do $$
declare actor uuid; academic uuid; collaborator uuid; product uuid; key uuid; car uuid;
begin
  select id into actor from public.usuarios where role = 'ADMIN' and is_active limit 1;
  if actor is null then raise exception 'Teste requer ADMIN ativo existente.'; end if;
  insert into public.academics(name) values ('Teste transacional 0010') returning id into academic;
  insert into public.collaborators(name) values ('Teste transacional 0010') returning id into collaborator;
  insert into public.products(name,qtd) values ('Teste transacional 0010',3) returning id into product;
  insert into public.keys(name) values ('Teste transacional 0010') returning id into key;
  insert into public.car_keys(name,mileage) values ('Teste transacional 0010',100) returning id into car;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('test.academic_lending',jsonb_build_object('academic',academic,'collaborator',collaborator,'product',product,'key',key,'car',car)::text,true);
  -- CHECK e FK são testados diretamente, sem desabilitar proteção alguma.
  begin
    insert into public.lendies(product_id,quantity,out_date) values (product,1,current_date);
    raise exception 'CHECK aceitou nenhum destinatário.';
  exception when check_violation then null; end;
  begin
    insert into public.key_lends(key_id,collaborator_id,academic_id,out_date) values (key,collaborator,academic,current_date);
    raise exception 'CHECK aceitou ambos os destinatários.';
  exception when check_violation then null; end;
  begin
    insert into public.car_key_lends(car_key_id,academic_id,out_date) values (car,gen_random_uuid(),current_date);
    raise exception 'FK aceitou acadêmico inexistente.';
  exception when foreign_key_violation then null; end;
end; $$;
set local role authenticated;
do $$
declare
  fixture jsonb := current_setting('test.academic_lending')::jsonb;
  academic uuid := (fixture->>'academic')::uuid;
  collaborator uuid := (fixture->>'collaborator')::uuid;
  product uuid := (fixture->>'product')::uuid;
  key uuid := (fixture->>'key')::uuid;
  car uuid := (fixture->>'car')::uuid;
  request uuid := gen_random_uuid(); loan uuid; key_loan uuid; car_loan uuid; previous_loan uuid;
begin
  -- Chamadas antigas sem p_academic_id permanecem válidas.
  previous_loan := public.lend_product(product,1,collaborator,gen_random_uuid());
  perform public.return_product(previous_loan);
  loan := public.lend_product(p_product_id=>product,p_quantity=>1,p_collaborator_id=>null,p_request_id=>request,p_academic_id=>academic);
  if not exists (select 1 from public.lendies l join public.academics a on a.id=l.academic_id
    where l.id=loan and l.academic_id=academic and l.collaborator_id is null) then
    raise exception 'Empréstimo acadêmico não visível com RLS e join.';
  end if;
  if (select qtd from public.products where id=product) <> 2 then raise exception 'Estoque incorreto.'; end if;
  if public.lend_product(product,1,null,request,academic) <> loan then raise exception 'Retry duplicou empréstimo.'; end if;
  if (select qtd from public.products where id=product) <> 2 then raise exception 'Retry consumiu estoque.'; end if;
  begin
    perform public.lend_product(product,1,collaborator,request,null);
    raise exception 'Retry permitiu trocar destinatário.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.lend_product(product,1,null,gen_random_uuid(),null);
    raise exception 'RPC aceitou nenhum destinatário.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.lend_key(key,collaborator,gen_random_uuid(),academic);
    raise exception 'RPC aceitou ambos os destinatários.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.lend_car(car,null,100,gen_random_uuid(),gen_random_uuid());
    raise exception 'RPC aceitou acadêmico inexistente.';
  exception when foreign_key_violation then null; end;
  key_loan := public.lend_key(key,null,gen_random_uuid(),academic);
  car_loan := public.lend_car(car,null,100,gen_random_uuid(),academic);
  if not exists (select 1 from public.key_lends where id=key_loan and academic_id=academic and collaborator_id is null)
    or not exists (select 1 from public.car_key_lends where id=car_loan and academic_id=academic and collaborator_id is null) then
    raise exception 'Chave/carro sem acadêmico.';
  end if;
  perform public.return_product(loan);
  perform public.return_key(key_loan);
  perform public.return_car(car_loan,110);
  if (select qtd from public.products where id=product) <> 3
    or (select status from public.keys where id=key) <> 'DISPONIVEL'
    or not exists (select 1 from public.car_keys where id=car and mileage=110 and status='DISPONIVEL') then
    raise exception 'Devolução não restaurou estoque/disponibilidade.';
  end if;
  if (select count(*) from public.operations where lend_id=loan) <> 2 then raise exception 'Histórico incorreto.'; end if;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.lend_product(product,1,null,gen_random_uuid(),academic);
    raise exception 'RPC aceitou chamada sem identidade.';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select 'PASS: produtos, chaves e carros com acadêmico; CHECK/FK; RLS; retry; devolução; autorização. ROLLBACK a seguir.' as result;
rollback;