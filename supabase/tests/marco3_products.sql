\set ON_ERROR_STOP on
-- SOMENTE Supabase isolado, como postgres, após migrations 0001–0006.
-- Fixtures fictícias + rollback. Storage abaixo testa metadados/RLS, não bytes/API.
begin;
insert into auth.users(id,email,raw_user_meta_data) values
 ('40000000-0000-4000-8000-000000000001','m3-user@example.invalid','{}'),
 ('40000000-0000-4000-8000-000000000002','m3-admin@example.invalid','{}');
update public.usuarios set role = 'ADMIN' where id = '40000000-0000-4000-8000-000000000002';
insert into public.products(id,name,qtd) values
 ('40000000-0000-4000-8000-000000000003','M3 vinculado',8);
insert into public.lendies(product_id,quantity,out_date) values
 ('40000000-0000-4000-8000-000000000003',1,current_date);

set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
do $$
declare pid uuid; affected integer;
begin
  insert into public.products(name,qtd,price,has_barcode) values ('M3 criado',12,5.50,false) returning id into pid;
  update public.products set name = 'M3 editado' where id = pid;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'USER não editou'; end if;
  if (select qtd from public.products where id = pid) <> 12 then raise exception 'Estoque alterado'; end if;
  begin
    update public.products set qtd = 99 where id = pid;
    raise exception 'UPDATE qtd permitido';
  exception when insufficient_privilege then null; end;
  begin
    update public.products set id = gen_random_uuid() where id = pid;
    raise exception 'UPDATE id permitido';
  exception when insufficient_privilege then null; end;
  begin
    update public.products set created_at = now() where id = pid;
    raise exception 'UPDATE created_at permitido';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.products(name,qtd) values ('Negativo',-1);
    raise exception 'Quantidade negativa aceita';
  exception when check_violation then null; end;
  begin
    insert into public.products(name,price) values ('Preço negativo',-1);
    raise exception 'Preço negativo aceito';
  exception when check_violation then null; end;
  begin
    insert into public.products(name) values ('   ');
    raise exception 'Nome vazio aceito';
  exception when check_violation then null; end;
  delete from public.products where id = pid;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'USER sem can_delete excluiu'; end if;
  begin
    update public.products set image_path = pid::text || '/40000000-0000-4000-8000-000000000099.png' where id = pid;
    raise exception 'Imagem inexistente aceita';
  exception when check_violation then null; end;
end; $$;

-- Prefixo exige produto existente. UUID novo; não há UPDATE/move de objetos.
insert into storage.objects(bucket_id,name) values
 ('product-images','40000000-0000-4000-8000-000000000003/40000000-0000-4000-8000-000000000099.png');
update public.products set image_path = '40000000-0000-4000-8000-000000000003/40000000-0000-4000-8000-000000000099.png'
where id = '40000000-0000-4000-8000-000000000003';
do $$
declare affected integer;
begin
  begin
    insert into storage.objects(bucket_id,name) values ('product-images','40000000-0000-4000-8000-000000000098/40000000-0000-4000-8000-000000000099.png');
    raise exception 'Upload sem produto existente permitido';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values ('product-images','../invalido.svg');
    raise exception 'Caminho inválido permitido';
  exception when insufficient_privilege then null; end;
  update storage.objects set name = '40000000-0000-4000-8000-000000000003/40000000-0000-4000-8000-000000000098.png'
  where bucket_id = 'product-images';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Objeto imutável atualizado'; end if;
  delete from storage.objects where bucket_id = 'product-images';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'USER sem flag removeu foto'; end if;
end; $$;
reset role;
update public.usuarios set limited_access = jsonb_set(limited_access,'{can_delete}','true') where id = '40000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
declare affected integer;
begin
  begin
    delete from public.products where id = '40000000-0000-4000-8000-000000000003';
    raise exception 'Produto emprestado excluído';
  exception when foreign_key_violation then null; end;
  delete from public.products where name = 'M3 editado';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'USER com flag não excluiu'; end if;
  delete from storage.objects where bucket_id = 'product-images';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Foto referenciada foi excluída'; end if;
  update public.products set image_path = null where id = '40000000-0000-4000-8000-000000000003';
  delete from storage.objects where bucket_id = 'product-images';
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Foto desvinculada não removida'; end if;
end; $$;
reset role;

-- Revogação atual prevalece sobre sessão ainda autenticada.
update public.usuarios set limited_access = '{"version":1,"can_read_inventory":true}' where id = '40000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$
declare affected integer;
begin
  begin
    insert into public.products(name,qtd) values ('Negado',0);
    raise exception 'Sem manage_products criou produto';
  exception when insufficient_privilege then null; end;
  begin
    insert into storage.objects(bucket_id,name) values ('product-images','40000000-0000-4000-8000-000000000003/40000000-0000-4000-8000-000000000099.png');
    raise exception 'Sem manage_products enviou foto';
  exception when insufficient_privilege then null; end;
  update public.products set name = 'Negado' where id = '40000000-0000-4000-8000-000000000003';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Sem manage_products editou'; end if;
end; $$;
reset role;
update public.usuarios set is_active = false where id = '40000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ begin
  if exists (select 1 from public.products) then raise exception 'Inativo lê produtos'; end if;
end; $$;

select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
do $$
declare pid uuid;
begin
  insert into public.products(name,qtd) values ('ADMIN',2) returning id into pid;
  update public.products set name = 'ADMIN editado' where id = pid;
  begin
    update public.products set qtd = 5 where id = pid;
    raise exception 'ADMIN alterou qtd pelo cliente';
  exception when insufficient_privilege then null; end;
  delete from public.products where id = pid;
end; $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform id from public.products;
    raise exception 'anon lê produtos';
  exception when insufficient_privilege then null; end;
end; $$;
reset role;
rollback;