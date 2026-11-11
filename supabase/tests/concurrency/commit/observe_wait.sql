\set ON_ERROR_STOP on
-- Sessão C administrativa: executar enquanto B aguarda A, antes de COMMIT em A.
do $$ begin
  if not exists (select 1 from pg_stat_activity b join pg_stat_activity a
    on a.pid = any(pg_blocking_pids(b.pid))
    where a.application_name = 'uniguacu_phase2_a' and b.application_name = 'uniguacu_phase2_b'
      and a.datname = current_database() and b.datname = current_database()
      and b.wait_event_type = 'Lock') then
    raise exception 'Não há sobreposição comprovada A/B: teste inválido';
  end if;
end $$;
select application_name, state, wait_event_type, wait_event
  from pg_stat_activity where application_name in ('uniguacu_phase2_a', 'uniguacu_phase2_b');