\set ON_ERROR_STOP on
-- SOMENTE Supabase isolado como postgres, após 0001–0008. Nunca produção.
-- Verifica a expressão REAL instalada sem alterar empréstimos de negócio.
begin;
do $$
declare expression text; invalid boolean;
begin
  select pg_get_expr(ad.adbin, ad.adrelid) into expression
    from pg_attribute a join pg_attrdef ad
      on ad.adrelid = a.attrelid and ad.adnum = a.attnum
    where a.attrelid = 'public.car_key_lends'::regclass
      and a.attname = 'distance' and not a.attisdropped
      and a.attgenerated = 's' and a.atttypid = 'integer'::regtype;
  if expression is null then raise exception 'distance não é integer GENERATED STORED'; end if;
  execute format('create temporary table distance_cases (
    km_in integer, km_out integer, expected integer,
    distance integer generated always as (%s) stored) on commit drop', expression);
  insert into distance_cases(km_in,km_out,expected) values
    (null,null,null), (null,100,null), (100,null,null),
    (150,100,50), (100,100,0), (0,0,0), (90,100,-10),
    (2147483647,0,2147483647);
  select exists (select 1 from distance_cases where distance is distinct from expected) into invalid;
  if invalid then raise exception 'Expressão distance falhou nos casos de regressão'; end if;
  if exists (select 1 from public.car_key_lends where distance is distinct from
    (CASE WHEN km_in IS NULL OR km_out IS NULL THEN NULL ELSE km_in - km_out END)) then
    raise exception 'Distância persistida diverge da expressão aprovada';
  end if;
end; $$;
rollback;