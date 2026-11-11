-- Marco 2: sectors, suppliers, collaborators e academics. Revisar em ambiente isolado.
-- Pré-requisito: migrations 0001–0004 instaladas. Não reaplicar baseline.
begin;

do $$
declare t text;
begin
  foreach t in array array['sectors','suppliers','collaborators','academics'] loop
    if exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname <> t || '_select') then
      raise exception 'Políticas adicionais em %; reconciliar antes de aplicar 0005.', t;
    end if;
  end loop;
end; $$;

-- Sem backfill/saneamento silencioso; NOT VALID protege escritas novas.
alter table public.sectors add constraint sectors_name_not_blank check (length(btrim(name)) > 0) not valid;
alter table public.suppliers add constraint suppliers_name_not_blank check (length(btrim(fantasy_name)) > 0) not valid;
alter table public.collaborators add constraint collaborators_name_not_blank check (length(btrim(name)) > 0) not valid;
alter table public.academics add constraint academics_name_not_blank check (length(btrim(name)) > 0) not valid;
-- Mesmo contrato de formato do Zod, sem DV/consulta/normalização destrutiva.
alter table public.suppliers add constraint suppliers_document_format check (
  cnpj_cpf is null or btrim(cnpj_cpf) = '' or btrim(cnpj_cpf) ~* '^([0-9]{11}|[0-9]{3}\.[0-9]{3}\.[0-9]{3}-[0-9]{2}|[A-Z0-9]{12}[0-9]{2}|[A-Z0-9]{2}\.[A-Z0-9]{3}\.[A-Z0-9]{3}/[A-Z0-9]{4}-[0-9]{2})$'
) not valid;

do $$
declare t text; columns text;
begin
  foreach t in array array['sectors','suppliers','collaborators','academics'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all privileges on table public.%I from public, anon, authenticated', t);
    select string_agg(quote_ident(attname), ', ') into columns from pg_attribute
      where attrelid = format('public.%I', t)::regclass and attnum > 0 and not attisdropped;
    execute format('revoke all privileges (%s) on table public.%I from public, anon, authenticated', columns, t);
    execute format('grant select, delete on table public.%I to authenticated', t);
    columns := case t
      when 'sectors' then 'name'
      when 'suppliers' then 'fantasy_name, legal_name, cnpj_cpf'
      when 'collaborators' then 'name, identification, role_function, phone'
      when 'academics' then 'name, ra, course'
    end;
    execute format('grant insert (%s), update (%s) on table public.%I to authenticated', columns, columns, t);
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select to authenticated using (private.is_admin() or private.has_permission(''can_read_inventory''))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (private.is_admin() or (private.has_permission(''can_read_inventory'') and private.has_permission(''can_manage_catalogs'')))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (private.is_admin() or (private.has_permission(''can_read_inventory'') and private.has_permission(''can_manage_catalogs''))) with check (private.is_admin() or (private.has_permission(''can_read_inventory'') and private.has_permission(''can_manage_catalogs'')))', t || '_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (private.is_admin() or (private.has_permission(''can_read_inventory'') and private.has_permission(''can_manage_catalogs'') and private.has_permission(''can_delete'')))', t || '_delete', t);
  end loop;
end; $$;

-- Preservados: UUIDs, UNIQUE de sectors.name, FKs NO ACTION, created_at do servidor.
-- Sem UNIQUE novo em CPF/CNPJ, identificação ou RA; sem vínculos novos em academics.
commit;