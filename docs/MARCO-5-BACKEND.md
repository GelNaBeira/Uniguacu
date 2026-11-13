# Marco 5 — etapa 1 / banco de dados

## Estado e autorização

### Atualização — execução real via MCP em 13/11/2026

- Projeto de desenvolvimento autorizado: Uniguacu (`nfpptemkkgjdagcpuhfv`),
  PostgreSQL 17.11. MCP conectado como `current_user = session_user = postgres`.
- A 0009 foi aplicada com sucesso pelo MCP `apply_migration` e registrada como
  `20261113125615_0009_lending_rpcs`. As seis RPCs foram conferidas no catálogo:
  owner postgres, SECURITY DEFINER e search_path vazio. Não reaplicar a 0009.
- O arquivo local já estava sem LOCK TABLE global e não precisou de outra
  correção para ser instalado. Grants, RLS e locks internos foram preservados.
- Diagnóstico reproduzível, em transação com rollback: ACCESS EXCLUSIVE em lendies
  funciona como postgres; como authenticated retorna exatamente `42501: permission
  denied for table lendies`. Owner postgres, RLS ativa, authenticated somente SELECT.
  Isso confirma o mecanismo de privilégio, mas não comprova qual papel estava
  selecionado na tentativa histórica do SQL Editor. RLS não foi desativada.
- Teste real de lend_product como authenticated, com auth.uid do ADMIN ativo
  existente e produto existente `481c2051-5462-4265-99bd-f92f12c8bbfe`:
  empréstimo `4d054514-c390-4faf-bf24-f856812683e6`, quantidade 1, estoque 1 → 0;
  linha em lendies e operação PRODUCT_LEND verificadas por assertions SQL.
  Retry retorna o mesmo UUID sem consumir novamente. return_product repetida
  restaura estoque para 1 e mantém apenas duas operações (retirada/devolução).
- Não havia colaboradores cadastrados. Um colaborador fictício foi criado somente
  dentro da transação de teste. ROLLBACK removeu colaborador, empréstimo e operações;
  consulta posterior confirmou zero resíduos e estoque original 1.
- Integração adicional via MCP, com fixtures transacionais e rollback: seis RPCs,
  USER autorizado, estoque/histórico, retries, disponibilidade de chave, odômetro e
  distância do carro, entradas inválidas, UUID reutilizado entre tipos, devolução
  alheia/flag de escopo, revogação de permissão, usuário inativo, DML direto negado,
  anon e identidade ausente: todos aprovados por assertions e SQLSTATE esperado.
- Limites: não foi executado o arquivo psql completo com falha injetada no histórico,
  nem o runner de duas conexões. SQL com claims simuladas não testa assinatura JWT
  ou gateway HTTP. Esses gates continuam pendentes, sem impedir iniciar a interface.
- Histórico remoto de migrations estava vazio antes desta aplicação, apesar dos
  objetos anteriores já instalados. Não foram inventados registros para 0001–0008;
  reconciliar baseline antes de automatizar deploy por CLI.
- Advisor de segurança: RPCs autenticadas SECURITY DEFINER aparecem como alertas
  esperados pelo contrato de autorização interna. Alertas preexistentes separados:
  `public.rls_auto_enable()` executável por anon/authenticated e proteção contra
  senhas vazadas desabilitada; não alterados fora do escopo.
  Referências de remediação: `https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable`
  e `https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection`.
- Validação local repetida: 111 testes aprovados; ESLint e TypeScript retornaram 0
  (o wrapper de terminal reportou fechamento/código 1 após os processos terminarem).
  Build não reexecutado. Os bloqueios locais descritos abaixo são registro histórico,
  não significam ausência de execução SQL remota nesta atualização.

Em 13/11/2026, cliente confirmou 0007/0008 aplicadas, CRUD de chaves/carros
homologado e código enviado ao GitHub. Marco 4 oficialmente homologado.
Marco 5 autorizado em duas etapas; esta entrega é somente backend.

Contrato aprovado em esclarecimento: colaborador **obrigatório** nos novos
empréstimos. Acadêmicos, códigos individuais, devoluções parciais, faltantes,
SEM_DEVOLUCAO, indisponibilidade manual e atraso automático não habilitados.

## Migration e contratos

Arquivo: `C:\Projetos\Uniguacu\supabase\migrations\0009_lending_rpcs.sql`.
Todas as RPCs retornam o UUID do empréstimo (não o UUID da operação).

| RPC | Argumentos nomeados, na ordem da assinatura |
|---|---|
| lend_product | p_product_id uuid, p_quantity integer, p_collaborator_id uuid, p_request_id uuid |
| return_product | p_lend_id uuid |
| lend_key | p_key_id uuid, p_collaborator_id uuid, p_request_id uuid |
| return_key | p_lend_id uuid |
| lend_car | p_car_id uuid, p_collaborator_id uuid, p_km_out integer, p_request_id uuid |
| return_car | p_lend_id uuid, p_km_in integer |

- Operador vem de `auth.uid()`. ADMIN ativo ou USER ativo com leitura e
  can_lend/can_return. Devolução USER exige autor original ou can_view_all_lends.
- Flags atuais verificadas no banco. Lock FOR SHARE no perfil estabiliza a
  autorização na transação; revogação concorrente espera a transação autorizada.
- SECURITY DEFINER owner postgres, search_path vazio, tabelas qualificadas,
  EXECUTE apenas authenticated nas seis RPCs; helpers privados sem EXECUTE cliente.
- DML direto de cliente revogado em tabela e coluna, inclusive para ADMIN do app;
  RLS habilitada e policies restritivas negam INSERT/UPDATE/DELETE. SELECT mantém
  a matriz anterior. Não há desativação de RLS nem service role no aplicativo.
- Ordem: perfil → mutex de retry (somente empréstimo) → recurso FOR UPDATE →
  empréstimo FOR UPDATE (devolução) → histórico. Estoque/status/odômetro e operação
  na mesma transação; exceções propagadas. Índices únicos impedem dois empréstimos
  EM_ANDAMENTO/ATRASADO da mesma chave/carro; legado duplicado aborta a migration.
- Idempotência: UUID obrigatório por empréstimo, único por operador entre tipos,
  persistido no empréstimo e na operação. Retry com mesmo payload retorna o mesmo
  empréstimo, mesmo após devolução; outro payload/tipo com mesmo UUID é rejeitado.
  UUID novo é nova intenção: a interface deve preservar UUID em retry/timeout.
- Devolução integral repetida retorna o mesmo UUID sem duplicar histórico/estoque.
  Retry de carro com km_in diferente é rejeitado. Nenhuma RPC aceita delta de retorno.
- Carro: km_out inteiro >= 0 e >= mileage quando cadastrado; km_in >= km_out e
  >= mileage atual. A distância é gerada pela 0008. Cadastro administrativo continua
  podendo corrigir mileage; correção conflitante precisa ser reconciliada, não
  sobrescrita silenciosamente. Devolução atualiza mileage e disponibilidade.
- Produtos com barcode manual usam estoque agregado normalmente, sem exemplares.

## Dados incrementais e legado

Nos três empréstimos: out_at/returned_at timestamptz e request_id uuid; produto
também returned_quantity. Sem defaults/backfill que inventem dados históricos.
Novos comandos registram data efetiva do servidor em timestamptz; out_date e
out_time (produto) novos são projeções UTC explícitas. **UTC é armazenamento
técnico, não escolha de fuso operacional da interface.** return_date/time legados
não são sobrescritos; não há due_at nem cálculo automático de atraso.

Histórico: lend_id/key_lend_id/car_key_lend_id com FK sem cascade, request_id e
details JSONB com payload mínimo, nome do recurso e quantidade/odômetro conforme
fluxo. Tipos PRODUCT_LEND/RETURN, KEY_LEND/RETURN, CAR_LEND/RETURN já pertencem à
allowlist de leitura RLS. Nada de cópias de credenciais ou perfil inteiro.

CHECKs NOT VALID exigem contrato completo para linhas com request_id, sem certificar
legado. Empréstimos anteriores sem out_at/request_id são recusados pelas devoluções
até reconciliação administrativa aprovada; não presumir estoque já consumido,
operador, devolução anterior ou disponibilidade. Sem saneamento/apagamento automático.

## Aplicação e rollback

1. Confirmar ambiente de homologação, backup e 0001–0008 instaladas. Não executar
   0006a, baseline ou reaplicar migrations anteriores.
2. Revisar políticas, funções e empréstimos ativos legados. Preflight exige as
   quatro policies de leitura conhecidas; policies extras, RPCs existentes,
   colunas/índices conflitantes ou ativos duplicados abortam, sem remover proteções.
3. Executar a 0009 inteira como postgres/owner autorizado, de BEGIN a COMMIT.
   Não há LOCK TABLE global explícito; o DDL mantém locks implícitos necessários,
   com espera limitada a cinco segundos. Não aplicar com operação concorrente.
4. Erro: ROLLBACK na sessão antes de investigar/repetir. Não é idempotente.
   Antes do COMMIT o rollback é transacional. Depois, reversão por migration
   revisada preservando empréstimos/histórico; não apagar dados para desfazer deploy.
5. Pós-condições conferem RLS, ausência de DML por tabela/coluna e configuração das
   seis RPCs. Homologar com JWT ADMIN/USER via API: simulação de auth.uid no SQL não
   prova assinatura JWT, gateway ou configuração do projeto Supabase.

### Correção após erro 42501 no SQL Editor

Removido o LOCK TABLE global inicial após relato de `permission denied for table
lendies`. O ponto exato da falha não foi confirmado por linha/contexto remoto.
Mantidos BEGIN/COMMIT, FOR UPDATE/advisory locks das RPCs, RLS e revogações de
PUBLIC/anon/authenticated. Essas revogações não citam postgres; não conceder DML
ao cliente nem desativar RLS para instalar. Atomicidade não substitui serialização
das operações concorrentes. Se 42501 persistir, conferir current_user/session_user,
owner das tabelas e linha exata antes de qualquer mudança de privilégios. Executar
ROLLBACK na sessão com transação abortada e reaplicar o arquivo inteiro, somente
se a tentativa anterior não tiver sido confirmada. Não reparar aplicação parcial
com DROP, reset ou remoção de policies às cegas.

## Testes e limites

- Validação local em 13/11/2026: `npm test` **110 aprovados, zero falhas**
  (oito regressões textuais novas). ESLint do projeto e runner, TypeScript sem
  emissão e `node --check` do runner aprovados. `git diff --check` aprovado.
  Build não reexecutado; aplicação/interface não alteradas.
- Regressões Node: `C:\Projetos\Uniguacu\tests\lending-migration.test.ts`.
  Inspeção textual de seis RPCs, locks, grants e idempotência; não prova execução SQL.
- Integração SQL: `C:\Projetos\Uniguacu\supabase\tests\marco5_lending.sql`.
  Somente banco isolado como postgres, via psql após 0001–0009. Fixtures fictícias,
  ROLLBACK; valida seis fluxos, retries, falta de estoque, odômetro, destinatário,
  escopo, revogação/inativação, ADMIN, anon, DML e falha injetada no histórico durante
  empréstimos e devoluções. Não executar em produção.
- Runner: `C:\Projetos\Uniguacu\supabase\tests\run-marco5-local.mjs`.
  Comando na raiz: `node supabase/tests/run-marco5-local.mjs`. Opcional PG_BIN para
  instalação PostgreSQL completa já disponível. Cria cluster temporário loopback,
  sem .env/URL remota, aplica 0001–0009 (exclui 0006a) e usa simulação mínima Auth/
  Storage. Mantém artefatos temporários de diagnóstico e encerra o cluster ao final.
- Cenários concorrentes do runner: última unidade, devolução integral simultânea,
  mesma chave, mesmo carro e UUID de retry repetido. Duas conexões reais, bloqueio
  observado por pg_blocking_pids, transação A com COMMIT e estado final verificado.
  Timeout, erro inesperado ou ausência de bloqueio falham o runner, não são sucesso.
- **Execução real bloqueada nesta entrega:** `initdb` falhou porque a instalação
  `C:\Program Files\PostgreSQL\17\` não contém `share/postgres.bki`. Nenhuma migration
  ou conexão SQL real foi executada. Não foi instalada/reparada dependência.
- Não há prova de SQL/RLS/concorrência até o runner passar em instalação completa
  e a integração ser homologada no Supabase isolado. pgTAP não foi instalado;
  testes SQL usam assertions/SQLSTATE e runner Node sem bibliotecas novas.

## Plano da etapa 2 — /home (não implementada)

1. Validar a 0009 e confirmar fuso de exibição antes dos formulários operacionais.
2. Criar schemas Zod e Server Actions que recarregam perfil e usam cliente Supabase
   com sessão do usuário, nunca service role. IDs/quantidade/odômetro validados;
   nenhuma escrita direta em empréstimos/operations/estoque/status.
3. Home com seções produto/chave/carro: recurso, colaborador obrigatório,
   quantidade ou km_out; opções paginadas sem truncamento silencioso.
4. Gerar UUID da intenção, preservar durante pendência/retry e trocar somente após
   sucesso ou nova intenção explícita. Evitar submit antes de hidratação/duplicado.
5. Listar empréstimos visíveis com filtros e paginação server-side; devolução integral
   com confirmação, km_in obrigatório para carro. Retirar controles não autorizados,
   sem tratar esconder botão como segurança. Legado bloqueado com mensagem específica.
6. Mapear SQLSTATE para mensagens seguras: 42501 autorização, 22023 payload/retry,
   P0002 não encontrado, 23514 estado/estoque/odômetro, 23503 vínculo e 22003 overflow.
   Timeout/erro de serialização mantém UUID e orienta retry, sem afirmar sucesso.
7. Testes unitários, integração RPC, E2E ADMIN/USER, revogação, timeout, teclado,
   responsividade e regressão. Só declarar Marco 5 concluído após gates de banco,
   concorrência real e interface; sem iniciar histórico/admin/relatórios do Marco 6.

Referências técnicas oficiais: documentação PostgreSQL 17, capítulo Explicit
Locking; Supabase Docs, Database Functions e Row Level Security.