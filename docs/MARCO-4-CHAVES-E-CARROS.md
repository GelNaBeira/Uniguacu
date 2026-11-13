# Marco 4 — Chaves e carros

## Entrega

- `/keys` e `/cars`: listagem server-side, busca literal por nome, filtro de disponibilidade, paginação de dez registros, estados vazios/erro/carregamento.
- Criação, edição e exclusão com confirmação; vínculos de empréstimos preservados por FK.
- Menu e breadcrumbs integrados; componentes e serviços compartilhados apenas entre essas duas entidades.
- Formulários com prevenção de submit nativo, bloqueio até hidratação, erro sem apagar os campos e retorno buscando o nome salvo.
- Status exibido desabilitado, sem campo enviado ao banco. Criação usa default `DISPONIVEL`; edição não permite escrita de status, inclusive ADMIN.
- Carros: quilometragem inteira não negativa ou NULL (campo opcional da baseline), limite PostgreSQL de 2.147.483.647. Novo formulário inicia em 0.
- Decisão confirmada: USER autorizado informa quilometragem inicial; somente ADMIN ativo corrige na edição. Aviso de atualização automática por empréstimos presente no formulário.

## Segurança

Permissões atuais são consultadas em cada ação e novamente via RLS no banco:

| Operação | ADMIN ativo | USER ativo |
| --- | --- | --- |
| Listar | Sim | `can_read_inventory` |
| Criar/editar nome | Sim | leitura + `can_manage_keys` ou `can_manage_cars` |
| Excluir | Sim | leitura + manage da entidade + `can_delete` |
| Informar mileage inicial | Sim | leitura + `can_manage_cars` |
| Corrigir mileage | RPC administrativa | Não |
| Escrever status diretamente | Não | Não |

RLS governa acesso às linhas; grants por coluna impedem INSERT/UPDATE direto de `status` e UPDATE de `mileage`. Não se tenta comparar OLD/NEW em policy RLS. Nenhum grant para `anon`/PUBLIC.

`public.admin_update_car_registration(uuid,text,integer)` atualiza nome e quilometragem atomicamente. `SECURITY DEFINER`, owner `postgres`, search_path vazio, referências qualificadas, sem SQL dinâmico. EXECUTE para authenticated exige `auth.uid()` presente e `private.is_admin()` atual no banco. Não aceita nem altera status. UPDATE REST de mileage é bloqueado também para ADMIN, que usa a RPC. Não usa service role na aplicação.

A implementação da mudança automática de status/quilometragem nos empréstimos pertence ao próximo marco; nesta entrega não há movimentação nem alteração das tabelas de empréstimos.

## Aplicação manual no Supabase

1. Usar o ambiente de homologação e confirmar backup e migrations 0001–0006 já instaladas. **Não executar 0006a** nem reaplicar baseline.
2. Conferir policies atuais de `public.keys` e `public.car_keys`. O preflight da 0007 aceita somente a policy de leitura original de cada tabela. Policies extras ou RPC já existente provocam erro e rollback: reconciliar antes, sem remover proteções às cegas.
3. Executar **todo** `C:\Projetos\Uniguacu\supabase\migrations\0007_keys_cars_crud.sql`, de BEGIN a COMMIT, incluindo todos os DO. Não executar apenas trechos de grants/policies.
4. Se qualquer instrução falhar, executar ROLLBACK na sessão antes de nova tentativa. Arquivo não é reaplicável após sucesso; não altera histórico anterior.
5. Conferir oito policies em `pg_policies` (SELECT/INSERT/UPDATE/DELETE por tabela), grants e RPC. Blocos finais checam completude, roles, operações, expressões obrigatórias, RLS, grants protegidos e configuração da RPC. Não provam equivalência semântica nem substituem testes reais.

Constraints de nome não vazio e mileage não negativo são `NOT VALID`: passam a proteger novas escritas, mas não corrigem nem certificam dados legados. Um legado inválido pode exigir correção ao editar. Índices por nome/status são criados sem remover registros. UUIDs, defaults de mileage e FKs existentes preservados; status default reafirmado sem atualizar linhas existentes.

## Homologação

- ADMIN: criar chave e carro (incluindo mileage 0, positivo e vazio), editar nome e corrigir mileage; verificar preservação de status e exclusão sem vínculo.
- USER com leitura/manage: criar e editar; mileage informado inicialmente e bloqueado na edição. USER sem leitura/manage não escreve; flags de carros/chaves independentes.
- Exclusão USER exige `can_delete`; registro com empréstimo não pode ser removido.
- Tentar forjar `status`, mileage no UPDATE de USER e acesso à RPC: rejeitados. Mesmo ADMIN não altera status nem mileage via UPDATE direto.
- Busca por nome, nomes com `%`/`_`, status combinado com busca e mudança de página mantêm filtros. Status inválido mostra erro sem ampliar a consulta.
- Revogar flags/desativar perfil e repetir operação com a mesma sessão.
- Confirmar manutenção do status indisponível ao editar um item já emprestado.

## Validações executadas

- `npm test`: **96 aprovados, zero falhas** (20 novos testes do Marco 4).
- `npm run lint`: aprovado, sem warnings.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado, incluindo as seis rotas de listagem/cadastro/edição.
- Playwright, sessão isolada sem cookies: as seis rotas protegidas redirecionaram para `/login`.
- `git diff --check`: aprovado.

## Limitações e pendências

- `C:\Projetos\Uniguacu\supabase\tests\marco4_keys_cars.sql` preparado para Supabase **isolado** via psql, com fixtures e ROLLBACK. **Não executado:** ambiente sem PostgreSQL/psql, Docker ou Supabase CLI disponíveis. Testes Node usam mocks e inspeção textual, não comprovam execução SQL/RLS.
- CRUD autenticado persistido, RPC e policies reais pendentes da aplicação manual da migration e homologação ADMIN/USER.
- Nenhuma alteração remota, push ou deploy realizado pelo agente. Dependências não instaladas. Diagnósticos temporários anteriores preservados fora deste escopo.