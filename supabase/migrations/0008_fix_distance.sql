-- Correção complementar ao Marco 4. Aplicar após 0001–0007, em homologação.
-- Executar o arquivo INTEIRO como postgres, após backup, de BEGIN até COMMIT.
-- Não executar 0006a nem reaplicar baseline. Não cria fluxos do Marco 5.
begin;
set local lock_timeout = '5s';

-- Evita alteração concorrente de dados/schema entre preflight e correção.
lock table public.car_key_lends in access exclusive mode;

do $$
declare
  distance_column record;
begin
  select a.attnum, a.attgenerated, a.atttypid, a.attacl, a.attnotnull,
    col_description(a.attrelid, a.attnum) as description
    into distance_column
    from pg_attribute a
    where a.attrelid = 'public.car_key_lends'::regclass
      and a.attname = 'distance' and not a.attisdropped;
  if not found then
    raise exception 'Coluna car_key_lends.distance ausente; revisar catálogo antes da 0008.';
  end if;
  if distance_column.attgenerated <> 's' or distance_column.atttypid <> 'integer'::regtype then
    raise exception 'distance deve ser integer GENERATED STORED; revisar catálogo antes da 0008.';
  end if;
  if (select count(*) from pg_attribute where attrelid = 'public.car_key_lends'::regclass
      and attname in ('km_in','km_out') and not attisdropped
      and atttypid = 'integer'::regtype and attgenerated = '') <> 2 then
    raise exception 'km_in/km_out incompatíveis com a baseline; revisar antes da 0008.';
  end if;

  if current_setting('server_version_num')::integer >= 170000 then
    -- Mantém identidade, posição, grants e dependências da coluna.
    execute 'alter table public.car_key_lends alter column distance set expression as
      (CASE WHEN km_in IS NULL OR km_out IS NULL THEN NULL ELSE km_in - km_out END)';
  else
    -- PostgreSQL anterior ao 17: não remover índices/constraints/views/policies
    -- nem perder grants/comentários customizados silenciosamente ao recriar.
    if exists (
      select 1 from pg_depend d
      where d.refclassid = 'pg_class'::regclass
        and d.refobjid = 'public.car_key_lends'::regclass
        and d.refobjsubid = distance_column.attnum
        and not (d.classid = 'pg_attrdef'::regclass and d.objid = (
          select ad.oid from pg_attrdef ad
          where ad.adrelid = 'public.car_key_lends'::regclass
            and ad.adnum = distance_column.attnum))
    ) or distance_column.attacl is not null or distance_column.attnotnull
      or distance_column.description is not null then
      raise exception 'distance possui dependências/metadados customizados; inventariar e preservar antes da 0008. Nenhuma remoção automática permitida.';
    end if;
    alter table public.car_key_lends drop column distance restrict;
    alter table public.car_key_lends add column distance integer generated always as
      (CASE WHEN km_in IS NULL OR km_out IS NULL THEN NULL ELSE km_in - km_out END) stored;
  end if;
end; $$;

-- Recalcula somente distance; UUIDs, odômetros, status, FKs, RLS e dados-fonte
-- são preservados. Não saneia legado com km_in < km_out nem cria constraints:
-- a validação da devolução pertence ao Marco 5.
do $$
begin
  if exists (select 1 from public.car_key_lends
    where distance is distinct from
      (CASE WHEN km_in IS NULL OR km_out IS NULL THEN NULL ELSE km_in - km_out END)) then
    raise exception '0008: distância persistida divergente da regra aprovada.';
  end if;
end; $$;

analyze public.car_key_lends (distance);
commit;