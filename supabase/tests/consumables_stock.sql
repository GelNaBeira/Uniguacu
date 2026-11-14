-- Executar após 0011 como postgres em homologação. Tudo é revertido.
begin;
set local lock_timeout = '5s';
do $$
declare actor uuid; academic uuid; collaborator uuid; consumable uuid; reusable uuid;
begin
  select id into actor from public.usuarios where role = 'ADMIN' and is_active limit 1;
  if actor is null then raise exception 'Teste requer ADMIN ativo existente.'; end if;
  insert into public.academics(name,phone) values ('Teste transacional 0011','45999999999') returning id into academic;
  insert into public.collaborators(name) values ('Teste transacional 0011') returning id into collaborator;
  insert into public.products(name,qtd,is_consumable) values ('Teste consumível 0011',10,true) returning id into consumable;
  insert into public.products(name,qtd) values ('Teste retornável 0011',10) returning id into reusable;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('test.consumables_stock',jsonb_build_object('academic',academic,'collaborator',collaborator,'consumable',consumable,'reusable',reusable)::text,true);
end; $$;
set local role authenticated;
do $$
declare fixture jsonb := current_setting('test.consumables_stock')::jsonb;
  academic uuid := (fixture->>'academic')::uuid;
  collaborator uuid := (fixture->>'collaborator')::uuid;
  consumable uuid := (fixture->>'consumable')::uuid;
  reusable uuid := (fixture->>'reusable')::uuid;
  request uuid := gen_random_uuid(); stock_request uuid := gen_random_uuid(); loan uuid; entry uuid; normal uuid;
begin
  loan := public.lend_product(consumable,3,null,request,academic);
  if not exists (select 1 from public.lendies where id=loan and no_return and status='SEM_DEVOLUCAO'
    and returned_at is null and returned_quantity=0 and academic_id=academic) then
    raise exception 'Consumo não foi finalizado corretamente.';
  end if;
  if (select qtd from public.products where id=consumable) <> 7 then raise exception 'Baixa incorreta.'; end if;
  if public.lend_product(consumable,3,null,request,academic) <> loan then raise exception 'Retry duplicou consumo.'; end if;
  begin
    perform public.return_product(loan);
    raise exception 'Consumível aceitou devolução.';
  exception when check_violation then null; end;
  if (select qtd from public.products where id=consumable) <> 7 then raise exception 'Retry/devolução alterou estoque.'; end if;
  entry := public.add_product_stock(consumable,5,current_date,'NF teste',stock_request);
  if public.add_product_stock(consumable,5,current_date,'NF teste',stock_request) <> entry then raise exception 'Retry duplicou entrada.'; end if;
  if (select qtd from public.products where id=consumable) <> 12 then raise exception 'Entrada/retry incorretos.'; end if;
  if not exists (select 1 from public.operations where id=entry and operation_type='PRODUCT_STOCK_ENTRY'
    and details->'request'->>'note'='NF teste') then raise exception 'Entrada sem auditoria visível via RLS.'; end if;
  begin
    perform public.add_product_stock(consumable,6,current_date,'NF teste',stock_request);
    raise exception 'Retry permitiu alterar quantidade.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.lend_product(consumable,1,collaborator,stock_request);
    raise exception 'UUID de entrada reutilizado em empréstimo.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.add_product_stock(consumable,1,current_date,'NF teste',request);
    raise exception 'UUID de empréstimo reutilizado em entrada.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.add_product_stock(consumable,0,current_date,'',gen_random_uuid());
    raise exception 'Quantidade zero aceita.';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.lend_product(consumable,13,collaborator,gen_random_uuid());
    raise exception 'Estoque insuficiente aceito.';
  exception when check_violation then null; end;
  begin
    perform public.add_product_stock(consumable,2147483647,current_date,'',gen_random_uuid());
    raise exception 'Overflow aceito.';
  exception when numeric_value_out_of_range then null; end;
  normal := public.lend_product(reusable,2,collaborator,gen_random_uuid());
  if (select status from public.lendies where id=normal) <> 'EM_ANDAMENTO' then raise exception 'Regressão retornável.'; end if;
  -- Reclassificação futura não altera o contrato gravado na saída.
  update public.products set is_consumable=true where id=reusable;
  perform public.return_product(normal);
  perform public.return_product(normal);
  if (select qtd from public.products where id=reusable) <> 10 then raise exception 'Retorno/retry incorretos.'; end if;
  begin
    update public.products set qtd=99 where id=consumable;
    raise exception 'UPDATE direto de estoque permitido.';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub','',true);
  begin
    perform public.add_product_stock(consumable,1,current_date,'',gen_random_uuid());
    raise exception 'Entrada sem identidade permitida.';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
select 'PASS: consumo definitivo, retorno bloqueado, entrada auditada, retry, UUID entre tipos, overflow, RLS e regressão retornável. ROLLBACK a seguir.' as result;
rollback;