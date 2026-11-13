\set ON_ERROR_STOP on
-- Somente banco ISOLADO como postgres, após 0001–0009. Fixtures e ROLLBACK.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('90000000-0000-4000-8000-000000000001','m5-user@example.invalid','{}'),
 ('90000000-0000-4000-8000-000000000002','m5-other@example.invalid','{}'),
 ('90000000-0000-4000-8000-000000000003','m5-admin@example.invalid','{}');
update public.usuarios set role = 'ADMIN' where id = '90000000-0000-4000-8000-000000000003';
insert into public.collaborators(id,name) values ('90000000-0000-4000-8000-000000000010','M5 colaborador');
insert into public.products(id,name,qtd) values ('90000000-0000-4000-8000-000000000011','M5 produto',5);
insert into public.keys(id,name) values ('90000000-0000-4000-8000-000000000012','M5 chave');
insert into public.car_keys(id,name,mileage) values ('90000000-0000-4000-8000-000000000013','M5 carro',100);

create function pg_temp.expect_error(command text, expected_state text)
returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Comando deveria falhar: %',command;
exception when others then
  if sqlstate <> expected_state then raise exception 'Esperado %, recebido %: %',expected_state,sqlstate,sqlerrm; end if;
end; $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
do $$
declare p uuid := '90000000-0000-4000-8000-000000000011';
  c uuid := '90000000-0000-4000-8000-000000000010';
  k uuid := '90000000-0000-4000-8000-000000000012';
  car uuid := '90000000-0000-4000-8000-000000000013';
  request uuid := '90000000-0000-4000-8000-000000000020';
  loan uuid; key_loan uuid; car_loan uuid; t text; col text;
begin
  perform pg_temp.expect_error(format('select public.lend_product(%L,1,null,%L)',p,request),'22023');
  perform pg_temp.expect_error(format('select public.lend_product(%L,0,%L,%L)',p,c,request),'22023');
  perform pg_temp.expect_error(format('select public.lend_product(%L,6,%L,%L)',p,c,request),'23514');
  perform pg_temp.expect_error(format('select public.lend_product(%L,1,%L,null)',p,c),'22023');
  perform pg_temp.expect_error(format('select public.lend_product(%L,1,%L,%L)',p,'90000000-0000-4000-8000-000000000099',request),'23503');
  loan := public.lend_product(p,2,c,request);
  if public.lend_product(p,2,c,request) <> loan or (select qtd from public.products where id = p) <> 3 then
    raise exception 'Retry retirou estoque novamente';
  end if;
  perform pg_temp.expect_error(format('select public.lend_product(%L,1,%L,%L)',p,c,request),'22023');
  perform pg_temp.expect_error(format('select public.lend_key(%L,%L,%L)',k,c,request),'22023');
  perform public.return_product(loan);
  perform public.return_product(loan);
  if (select qtd from public.products where id = p) <> 5
    or (select count(*) from public.operations where lend_id = loan) <> 2 then
    raise exception 'Devolução de produto duplicada/incompleta';
  end if;
  key_loan := public.lend_key(k,c,'90000000-0000-4000-8000-000000000021');
  perform pg_temp.expect_error(format('select public.lend_key(%L,%L,%L)',k,c,'90000000-0000-4000-8000-000000000022'),'23514');
  perform public.return_key(key_loan);
  perform public.return_key(key_loan);
  if (select status from public.keys where id = k) <> 'DISPONIVEL'
    or (select count(*) from public.operations where key_lend_id = key_loan) <> 2 then
    raise exception 'Devolução de chave duplicada/incompleta';
  end if;
  perform pg_temp.expect_error(format('select public.lend_car(%L,%L,99,%L)',car,c,'90000000-0000-4000-8000-000000000023'),'23514');
  car_loan := public.lend_car(car,c,100,'90000000-0000-4000-8000-000000000023');
  if (select distance from public.car_key_lends where id = car_loan) is not null then raise exception 'Distância antes de devolver'; end if;
  perform pg_temp.expect_error(format('select public.return_car(%L,99)',car_loan),'23514');
  perform pg_temp.expect_error(format('select public.return_car(%L,null)',car_loan),'22023');
  perform public.return_car(car_loan,150);
  perform public.return_car(car_loan,150);
  perform pg_temp.expect_error(format('select public.return_car(%L,151)',car_loan),'22023');
  if (select distance from public.car_key_lends where id = car_loan) <> 50
    or (select mileage from public.car_keys where id = car) <> 150
    or (select count(*) from public.operations where car_key_lend_id = car_loan) <> 2 then
    raise exception 'Devolução de carro duplicada/incompleta';
  end if;
  -- Nenhum cliente escreve diretamente, mesmo por coluna.
  foreach t in array array['lendies','key_lends','car_key_lends','operations'] loop
    col := case when t = 'operations' then 'description' else 'status' end;
    perform pg_temp.expect_error(format('insert into public.%I default values',t),'42501');
    perform pg_temp.expect_error(format('update public.%I set %I = %I',t,col,col),'42501');
    perform pg_temp.expect_error(format('delete from public.%I',t),'42501');
  end loop;
end; $$;
reset role;

-- Falha no histórico deve desfazer TODAS as escritas da RPC, em cada fluxo.
create function pg_temp.reject_operation() returns trigger language plpgsql as $$
begin raise exception 'Falha injetada somente no banco isolado' using errcode = '23514'; end; $$;
create trigger m5_fail_history before insert on public.operations for each row execute function pg_temp.reject_operation();
set local role authenticated;
do $$
declare command text;
begin
  foreach command in array array[
    'select public.lend_product(''90000000-0000-4000-8000-000000000011'',1,''90000000-0000-4000-8000-000000000010'',''90000000-0000-4000-8000-000000000030'')',
    'select public.lend_key(''90000000-0000-4000-8000-000000000012'',''90000000-0000-4000-8000-000000000010'',''90000000-0000-4000-8000-000000000031'')',
    'select public.lend_car(''90000000-0000-4000-8000-000000000013'',''90000000-0000-4000-8000-000000000010'',150,''90000000-0000-4000-8000-000000000032'')'
  ] loop perform pg_temp.expect_error(command,'23514'); end loop;
  if (select qtd from public.products where id = '90000000-0000-4000-8000-000000000011') <> 5
    or exists (select 1 from public.lendies where request_id = '90000000-0000-4000-8000-000000000030')
    or (select status from public.keys where id = '90000000-0000-4000-8000-000000000012') <> 'DISPONIVEL'
    or (select status from public.car_keys where id = '90000000-0000-4000-8000-000000000013') <> 'DISPONIVEL' then
    raise exception 'Falha no histórico não reverteu empréstimo';
  end if;
end; $$;
reset role;
drop trigger m5_fail_history on public.operations;

-- Prepara os três tipos para falhar no histórico DURANTE a devolução.
set local role authenticated;
select public.lend_product('90000000-0000-4000-8000-000000000011',1,'90000000-0000-4000-8000-000000000010','90000000-0000-4000-8000-000000000050') as rollback_product \gset
select public.lend_key('90000000-0000-4000-8000-000000000012','90000000-0000-4000-8000-000000000010','90000000-0000-4000-8000-000000000051') as rollback_key \gset
select public.lend_car('90000000-0000-4000-8000-000000000013','90000000-0000-4000-8000-000000000010',150,'90000000-0000-4000-8000-000000000052') as rollback_car \gset
reset role;
create trigger m5_fail_history before insert on public.operations for each row execute function pg_temp.reject_operation();
set local role authenticated;
select pg_temp.expect_error(format('select public.return_product(%L)',:'rollback_product'),'23514');
select pg_temp.expect_error(format('select public.return_key(%L)',:'rollback_key'),'23514');
select pg_temp.expect_error(format('select public.return_car(%L,200)',:'rollback_car'),'23514');
do $$ begin
  if (select qtd from public.products where id = '90000000-0000-4000-8000-000000000011') <> 4
    or (select status from public.keys where id = '90000000-0000-4000-8000-000000000012') <> 'INDISPONIVEL'
    or (select status from public.car_keys where id = '90000000-0000-4000-8000-000000000013') <> 'INDISPONIVEL'
    or (select mileage from public.car_keys where id = '90000000-0000-4000-8000-000000000013') <> 150
    or exists (select 1 from public.lendies where request_id = '90000000-0000-4000-8000-000000000050' and (status <> 'EM_ANDAMENTO' or returned_at is not null or returned_quantity <> 0))
    or exists (select 1 from public.key_lends where request_id = '90000000-0000-4000-8000-000000000051' and (status <> 'EM_ANDAMENTO' or returned_at is not null))
    or exists (select 1 from public.car_key_lends where request_id = '90000000-0000-4000-8000-000000000052' and (status <> 'EM_ANDAMENTO' or returned_at is not null or km_in is not null or distance is not null)) then
    raise exception 'Falha no histórico não reverteu devolução';
  end if;
end; $$;
reset role;
drop trigger m5_fail_history on public.operations;
set local role authenticated;
select public.return_product(:'rollback_product');
select public.return_key(:'rollback_key');
select public.return_car(:'rollback_car',200);
reset role;

-- Devolução alheia negada; flag atual permite; revogação e perfil inativo negam.
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select public.lend_product('90000000-0000-4000-8000-000000000011',1,'90000000-0000-4000-8000-000000000010','90000000-0000-4000-8000-000000000040') as scoped_loan \gset
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.expect_error(format('select public.return_product(%L)',:'scoped_loan'),'42501');
reset role;
update public.usuarios set limited_access = jsonb_set(limited_access,'{can_view_all_lends}','true') where id = '90000000-0000-4000-8000-000000000002';
set local role authenticated;
select public.return_product(:'scoped_loan');
reset role;
update public.usuarios set limited_access = jsonb_set(limited_access,'{can_lend}','false') where id = '90000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.expect_error('select public.lend_product(''90000000-0000-4000-8000-000000000011'',1,''90000000-0000-4000-8000-000000000010'',''90000000-0000-4000-8000-000000000041'')','42501');
reset role;
update public.usuarios set is_active = false where id = '90000000-0000-4000-8000-000000000002';
set local role authenticated;
select pg_temp.expect_error(format('select public.return_product(%L)',:'scoped_loan'),'42501');
reset role;

-- ADMIN ativo não depende de flags; ainda assim DML direto negado.
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select public.lend_product('90000000-0000-4000-8000-000000000011',1,'90000000-0000-4000-8000-000000000010','90000000-0000-4000-8000-000000000042') as admin_loan \gset
select public.return_product(:'admin_loan');
select pg_temp.expect_error('update public.lendies set status = ''DEVOLVIDO''','42501');
reset role;
set local role anon;
select pg_temp.expect_error('select public.return_product(null)','42501');
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true);
select pg_temp.expect_error('select public.return_product(null)','42501');
reset role;
rollback;