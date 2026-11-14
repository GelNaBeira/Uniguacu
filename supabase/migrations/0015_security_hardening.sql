-- Homologar antes de liberar o código: as actions falham fechadas sem esta RPC.
-- Não reaplicar 0014. Não altera registros de domínio nem remove arquivos Storage.
begin;
set local lock_timeout = '5s';

-- Event trigger de infraestrutura: não é uma RPC pública de negócio.
do $$ begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end $$;

-- Cardinalidade limitada a duas linhas por usuário; cascade remove apenas quotas.
create table private.action_rate_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('reports','lending')),
  window_start timestamptz not null,
  requests integer not null check (requests > 0),
  primary key (user_id, scope)
);
alter table private.action_rate_limits enable row level security;
revoke all on table private.action_rate_limits from public, anon, authenticated;

create function public.consume_action_rate_limit(p_scope text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  moment timestamptz := clock_timestamp();
  quota integer;
  period interval;
  consumed boolean;
begin
  if actor is null or not exists (select 1 from public.usuarios where id = actor and is_active) then
    raise exception 'Acesso negado' using errcode = '42501';
  end if;
  if p_scope = 'reports' then
    quota := 1; period := interval '20 seconds';
    if not (private.is_admin() or (private.has_permission('can_read_inventory') and private.has_permission('can_view_reports'))) then
      raise exception 'Acesso negado' using errcode = '42501';
    end if;
  elsif p_scope = 'lending' then
    quota := 30; period := interval '60 seconds';
    if not (private.is_admin() or (private.has_permission('can_read_inventory') and
      (private.has_permission('can_lend') or private.has_permission('can_return')))) then
      raise exception 'Acesso negado' using errcode = '42501';
    end if;
  else
    raise exception 'Escopo inválido' using errcode = '22023';
  end if;

  -- UPSERT serializa concorrentes pela PK. Cliente não escolhe ator, limite ou janela.
  insert into private.action_rate_limits as limits (user_id,scope,window_start,requests)
    values (actor,p_scope,moment,1)
  on conflict (user_id,scope) do update set
    requests = case when limits.window_start <= moment - period then 1 else limits.requests + 1 end,
    window_start = case when limits.window_start <= moment - period then moment else limits.window_start end
  where limits.window_start <= moment - period or limits.requests < quota
  returning true into consumed;
  return coalesce(consumed,false);
end $$;
revoke all on function public.consume_action_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_action_rate_limit(text) to authenticated;
commit;