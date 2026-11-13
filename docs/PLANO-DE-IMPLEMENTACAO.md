# Plano de Implementação — Almoxarifado Uniguacu

**Estado em 13/11/2026:** Fase 3 / Marco 5 autorizado, dividido em backend e interface. Marcos 1–4 concluídos e commitados; cliente confirmou 0007/0008 aplicadas e Marco 4 oficialmente homologado. Etapa 1: 0009 aplicada no Supabase de desenvolvimento via MCP, registrada como `20261113125615_0009_lending_rpcs`; lend_product validada com produto existente (estoque 1 → 0 → 1) e seis RPCs/autorização testadas em transações com rollback. Concorrência entre conexões, falha injetada no histórico e gateway HTTP/JWT ainda pendentes; etapa 2 (/home) ainda não iniciada. Contratos e evidências em `C:\Projetos\Uniguacu\docs\MARCO-5-BACKEND.md`.
**Raiz de referência:** `C:\Projetos\Uniguacu\`.  
**Contrato:** `C:\Projetos\Uniguacu\docs\PDD.md`; fonte funcional exclusiva: `C:\Projetos\Uniguacu\docs\MAPA-FUNCIONAL.md`. SQL local de baseline: `C:\Projetos\Uniguacu\supabase\migrations\0001_initial_schema.sql`.

## Status consolidado e decisões vigentes

| Marco | Status da implementação | Evidência no Git |
|---|---|---|
| 1 — Setup, autenticação e layout | Concluído; homologação registrada no documento do Marco 2 | `2477896`, 11/11/2026 |
| 2 — Cadastros básicos | Concluído; homologação registrada no documento do Marco 3 | `2477896`, 11/11/2026 |
| 3 — Produtos | Concluído no escopo MVP aprovado; integração real banco/Storage depende das evidências de homologação | `08258a0`, 11/11/2026 |
| 4 — Chaves e carros | Oficialmente homologado pelo cliente em 13/11/2026; 0007/0008 aplicadas e CRUD validado no navegador | `9850249`, `00836db` e correção `78ac253` |
| 5 — Empréstimos e devoluções | Backend 0009 aplicado e seis RPCs testadas no Supabase de desenvolvimento; concorrência/HTTP e interface pendentes | Alterações locais desta etapa ainda sem commit |
| 6 — Histórico/admin/perfil/ajuda e relatórios | Planejado; não implementado | Sem commit de implementação |

Registros detalhados: `C:\Projetos\Uniguacu\docs\MARCO-1.md`, `C:\Projetos\Uniguacu\docs\MARCO-2-CATEGORIES.md`, `C:\Projetos\Uniguacu\docs\MARCO-2-ENTIDADES-SIMPLES.md`, `C:\Projetos\Uniguacu\docs\MARCO-3-PRODUTOS.md` e `C:\Projetos\Uniguacu\docs\MARCO-4-CHAVES-E-CARROS.md`. Conclusão de código não substitui os gates de banco, segurança e aceite operacional abaixo.

**D02 — Barcode/MVP mantido e reconfirmado em 13/11/2026:** estoque por `products.qtd`, sem rastreamento de códigos individuais ou por exemplar. `has_barcode` e `bar_code` continuam campos manuais opcionais do produto; sem geração/leitura automatizada, tabela de exemplares ou bibliotecas novas. `C:\Projetos\Uniguacu\app\(app)\product-codes\page.tsx` permanece como funcionalidade em desenvolvimento. As propostas históricas de códigos individuais abaixo não integram o aceite do MVP.

**Ajustes de escopo já aprovados:** quantidade inicial permitida no INSERT de produto, sem UPDATE direto de estoque; movimentações e histórico transacional pertencem ao Marco 5. A revisão da expressão de distância prevista em M4.4 é entregue separadamente na 0008; validações de devolução e odômetro permanecem no Marco 5.

### Aplicação manual da correção de distância

1. Confirmar backup, ambiente de homologação e migrations 0001–0006 instaladas. Aplicar primeiro `C:\Projetos\Uniguacu\supabase\migrations\0007_keys_cars_crud.sql` conforme o roteiro do Marco 4.
2. Aplicar **inteiro**, como postgres, `C:\Projetos\Uniguacu\supabase\migrations\0008_fix_distance.sql`, de BEGIN a COMMIT. **Não executar 0006a nem reaplicar a baseline.**
3. A 0008 usa `CASE WHEN km_in IS NULL OR km_out IS NULL THEN NULL ELSE km_in - km_out END`. Corrige a distância armazenada sem alterar odômetros, UUIDs, status, FKs ou RLS. Não saneia dados legados: com ambos os odômetros preenchidos e entrada menor que saída, a diferença continua negativa; a rejeição de devoluções inválidas será implementada no Marco 5.
4. PostgreSQL 17+ altera a expressão preservando a coluna. Em versões anteriores, a coluna gerada é recriada sem CASCADE e passa ao final da tabela; dependências ou grants/comentários/NOT NULL customizados fazem o preflight abortar para revisão, sem remoção silenciosa. Não há inventário remoto presumido. Referência técnica: documentação oficial PostgreSQL 17, seção ALTER TABLE / SET EXPRESSION AS, e PostgreSQL 16, seção ALTER TABLE.
5. A correção obtém lock exclusivo e pode recalcular a tabela; executar em janela sem uso concorrente. Espera pelo lock limitada a cinco segundos. Falha aborta a transação: executar ROLLBACK na sessão, investigar e só depois repetir. Antes do COMMIT, ROLLBACK preserva a expressão anterior; depois do sucesso, eventual reversão exige migration revisada, não reset ou restauração destrutiva automática.
6. Em Supabase **isolado**, validar `C:\Projetos\Uniguacu\supabase\tests\distance.sql` via psql: NULL/NULL, cada odômetro ausente, diferença positiva, zero e legado negativo. O teste usa a expressão real instalada e ROLLBACK; não executar em produção. A execução SQL real ainda depende de ambiente PostgreSQL disponível; regressões Node são apenas textuais.
7. **Gate concluído conforme confirmação do cliente em 13/11/2026:** 0007/0008 aplicadas, CRUD validado no navegador, Marco 4 homologado e Marco 5 autorizado. Nenhum banco remoto foi alterado pelo agente.

## 1. Regras de execução

1. Não iniciar implementação, instalar dependências, executar migrations ou modificar banco antes do “ok”.
2. Registrar aceite da matriz proposta e decisões D01–D13 do PDD. Resolver antes de cada marco os TODOs que o bloqueiam; não converter desconhecido em comportamento presumido.
3. Comparar schema remoto com baseline, preservar tabelas/UUIDs/dados e migrations existentes. O diretório local contém testes SQL anteriores; devem ser inventariados e avaliados antes de reaproveitamento, sem presumir que refletem o novo PDD.
4. Trabalhar em ambiente isolado; produção requer autorização específica e backup/restauração verificados.
5. Aprovar bibliotecas/versões antes da instalação. Obrigatórias por solicitação: Next.js 14+, TypeScript, Tailwind, shadcn/ui, Supabase, Zod. Bibliotecas de testes, barcode e relatórios são propostas, não instalações autorizadas.
6. Usar o JWT do usuário nos dados de negócio. Cliente privilegiado server-only exclusivamente nas operações de Auth que o exigem. Gate ADMIN no banco e no BFF; não acreditar em papel enviado pelo cliente.
7. Os SQLs no PDD são design. Produzir migrations completas, tipadas e verificadas somente na Fase 3. Nenhuma tabela nova de códigos será criada sem decisão D02.

**Estado do workspace verificado em 13/11/2026:** repositório Git na branch `main`, implementação Next.js em `app/`, componentes em `components/` e serviços em `lib/`, além de docs e migrations. Sidebar responsiva com submenus entregue. Captura Angular estática preservada: não substituir `index.html`/bundles/assets nem executar scaffold sobre a raiz ocupada. Referências a `origin/main` são locais e não comprovam deploy ou estado remoto atual.

## 2. Estrutura-alvo completa

Todos os caminhos da árvore são relativos à raiz absoluta acima. A árvore preserva a estrutura-alvo do planejamento, não um inventário atualizado: partes dos Marcos 1–4 já existem e módulos dos Marcos 5–6 permanecem futuros. Nomes de módulos internos são proposta organizacional; não são funcionalidades adicionais. Os destinos de todas as 33 rotas constam do PDD.

```text
C:\Projetos\Uniguacu\
├── docs/
│   ├── MAPA-FUNCIONAL.md                     existente, preservar
│   ├── PDD.md
│   └── PLANO-DE-IMPLEMENTACAO.md
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                             redirect /login
│   ├── not-found.tsx
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── forgot-password/page.tsx
│   │   └── reset-password/page.tsx
│   ├── auth/callback/route.ts
│   ├── (app)/
│   │   ├── layout.tsx                       sessão + navbar/sidebar/breadcrumb
│   │   ├── loading.tsx
│   │   ├── error.tsx
│   │   ├── home/page.tsx                    operação, não dashboard de gráficos
│   │   ├── products/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── product-codes/page.tsx
│   │   ├── collaborators/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── academics/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── keys/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── cars/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── categories/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── sectors/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── suppliers/
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx
│   │   │   └── [id]/edit/page.tsx
│   │   ├── admin/
│   │   │   ├── page.tsx
│   │   │   └── users/
│   │   │       ├── new/page.tsx
│   │   │       └── [id]/edit/page.tsx
│   │   ├── perfil/page.tsx
│   │   └── help/page.tsx
│   └── api/
│       ├── admin/users/route.ts              Auth Admin, POST autorizado
│       ├── admin/users/[id]/route.ts         alteração/exclusão autorizada
│       ├── account/route.ts                 comandos próprios que exigem servidor
│       └── reports/[format]/route.ts        PDF/XLSX; gate e escopo no banco
├── components/
│   ├── ui/                                 componentes shadcn selecionados
│   ├── layout/{navbar,sidebar,breadcrumb}.tsx
│   ├── forms/                              campos e mensagens reutilizáveis
│   └── shared/                             tabela, confirmação, empty/error state
├── features/
│   ├── auth/{actions,schemas}.ts
│   ├── users/{actions,queries,schemas}.ts
│   ├── catalogs/{actions,queries,schemas}.ts
│   ├── products/{actions,queries,schemas}.ts
│   ├── barcodes/                           bloqueado até D02
│   ├── keys/{actions,queries,schemas}.ts
│   ├── cars/{actions,queries,schemas}.ts
│   ├── lends/{actions,queries,schemas}.ts
│   ├── operations/queries.ts
│   └── reports/                            formatos aprovados no Marco 6
├── lib/
│   ├── supabase/{client,server,admin}.ts     admin server-only
│   ├── auth/{session,permissions}.ts
│   ├── storage.ts
│   ├── errors.ts
│   └── utils.ts
├── types/database.ts                       gerado do schema aprovado
├── supabase/
│   ├── config.toml                         ambiente local após setup
│   ├── migrations/
│   │   ├── 0001_initial_schema.sql         existente, não reescrever
│   │   ├── 0002_refinements.sql            somente alterações aprovadas
│   │   ├── 0003_rls_policies.sql           helpers, grants e políticas
│   │   └── <sequencia>_<tema>.sql          storage/RPCs e ajustes posteriores
│   └── tests/                              preservar; adicionar testes aderentes
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   └── fixtures/                           sintético; nenhum dado da captura
├── public/                                 assets autorizados e sanitizados
├── .github/workflows/ci.yml
├── .env.example                            nomes sem valores secretos
├── .gitignore
├── package.json
├── <lockfile do gerenciador aprovado>
├── next.config.js
├── next-env.d.ts
├── tailwind.config.ts
├── postcss.config.js
├── components.json
├── tsconfig.json
├── middleware.ts                           convenção final depende da versão aprovada
├── <configuração de lint da versão escolhida>
├── vitest.config.ts                        proposta, se aprovada
└── playwright.config.ts                    proposta, se aprovada
```

Não criar páginas públicas para histórico/relatórios sem evidência; consultar via Home/Admin e seus componentes. Aliases legados da tabela do PDD podem usar redirects de configuração; os de edição sem id retornam à lista para seleção. Não duplicar URLs usando route groups diferentes. Árvores com `{a,b}.ts` denotam arquivos separados a criar, não nomes literais.

## 3. Sequência e dependências globais

```text
OK + decisões mínimas + checkout correto
  -> M1 setup/auth/segurança/layout
  -> M2 cadastros simples
  -> M3 produtos/estoque/imagens/códigos
  -> M4 chaves/carros
  -> M5 empréstimos/devoluções/RPCs
  -> M6-A histórico/admin/perfil/help e aceite do MVP
  -> M6-B relatórios PDF/Excel (evolução pós-núcleo)
Depois: dashboard gráfico/importação, fora deste plano executável
```

M4 depende tecnicamente de M1/M2 e poderia ser desenvolvido sem códigos do M3, mas o plano mantém um marco por vez. D02 não deve bloquear cadastros sem código, porém bloqueia declarar completo o recurso de códigos. Não dar aceite integral a marco com funcionalidade substituída por stub sem redução de escopo expressa do cliente.

## 4. Marco 1 — Setup, autenticação, segurança e layout

### Pré-requisitos

“Ok” explícito; D01, decisões de perfil/contas D08 e refinamentos mínimos D09; acesso autorizado ao ambiente de desenvolvimento. Confirmar gerenciador, versões suportadas e aprovação de dependências. Conferir repositório/branch e preservar captura local. Não exigir senha/chave em mensagem; usar configuração local segura.

### Tarefas e dependências

| ID | Tarefa técnica | Depende de |
|---|---|---|
| M1.1 | Confirmar checkout/branch e estratégia de preservação; scaffold Next.js App Router/TS e scripts de lint/typecheck/build/test | Pré-requisitos |
| M1.2 | Configurar Tailwind e shadcn/ui; instalar apenas componentes necessários (Button, Input, Label, Card, Alert, Dialog, DropdownMenu, Sheet; seleção final conforme versões) | M1.1 + aprovação |
| M1.3 | Confrontar baseline com catálogo remoto em leitura; planejar backup/saneamento; criar 0002 somente com refinamentos aceitos | D09, M1.1 |
| M1.4 | 0003: helpers privados, retirada de políticas permissivas, grants por coluna, RLS das 13 tabelas; recursos não implementados ficam negados | M1.3, D01 |
| M1.5 | Configurar clientes browser/server e admin server-only; validar env sem expor segredos; gerar tipos do banco | M1.3–4 |
| M1.6 | Login/logout/recuperação/reset/callback; SSR com cookies; middleware e verificações server-side; desabilitar signup público | M1.5 |
| M1.7 | Layout autenticado navbar/sidebar/breadcrumb e Home estrutural; sem fluxos fictícios | M1.2, M1.6 |
| M1.8 | Bootstrap primeiro ADMIN autorizado, perfil seguro e impedimento de autoelevação; políticas de avatar após D11 | M1.4–6, D08/D11 |
| M1.9 | CI, ambiente de preview Vercel isolado, testes de sessão e RLS; revisar bundle/logs | M1.1–8 |

### Aceite verificável

- Instalação reproduzível com lockfile; typecheck/lint/build e testes mínimos passam.
- `/login`, `/forgot-password`, reset e callback funcionam de ponta a ponta; email inválido não revela existência de conta; redirect externo arbitrário é recusado.
- Sem sessão, rotas protegidas e comandos negam acesso; logout invalida navegação/dados autenticados em nova requisição.
- USER não cria/edita conta alheia, altera role/limited_access nem acessa relatório geral por chamada direta. RLS de usuarios não recursa.
- Todas as 13 tabelas permanecem com RLS habilitado; anon não acessa; flags ausentes negam; permissões revogadas refletem no comando seguinte.
- Não há service role no bundle público nem `.env` com segredo versionado. Preview não aponta ao banco de produção.
- Layout é utilizável por teclado e em viewport móvel; nenhum menu visível é considerado prova de autorização.

### Pacote inicial da Fase 3

Primeira entrega: `package.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `.env.example`; `0002_refinements.sql` se aplicável e `0003_rls_policies.sql`; páginas `(auth)/login`, `(auth)/forgot-password`, `(app)/layout`, `(app)/home`; middleware; shadcn configurado. Recuperação completa também exige reset/callback e clientes SSR, incluídos para não entregar fluxo incompleto. Dependendo do tamanho, dividir em commits revisáveis dentro do Marco 1. Não antecipar os marcos seguintes sem aceite.

## 5. Marco 2 — Cadastros simples

### Tarefas e dependências

| ID | Tarefa técnica | Depende de |
|---|---|---|
| M2.1 | Confirmar labels/campos inferidos e obrigatoriedade de categories, sectors, suppliers, collaborators, academics | M1; PDD 3.3–3.7 |
| M2.2 | Schemas Zod compartilhados pelo servidor e formulários; validar UUID e strings; sem inventar validação documental/RA único | M2.1 |
| M2.3 | Listagem, criação, edição por [id], confirmação de exclusão, estados vazios/erro, paginação e busca compatíveis com contrato | M2.2, RLS M1 |
| M2.4 | Gates/grants C e D(C); mapear erro de FK para conflito legível; testar acesso direto | M2.3 |
| M2.5 | Testes unitários/E2E CRUD e revisão RLS com USER restrito | M2.4 |

### Aceite verificável

- Cinco entidades podem ser criadas/editadas/listadas por ADMIN e USER autorizado; retorno persiste após reload.
- Nome vazio/UUID inválido não chegam como gravação válida; duplicidade de categoria/setor respeita constraint atual.
- USER sem can_manage_catalogs não escreve; sem can_delete não exclui, mesmo enviando DELETE manual.
- Cadastro referenciado não é removido; nenhuma relação/histórico é apagada em cascata.
- Editar id inexistente/fora do escopo apresenta estado seguro sem vazamento de dados.
- Cada entidade tem testes positivos/negativos e evidência de preview; validações de CPF/CNPJ/RA não confirmadas ficam TODO, não alegadamente concluídas.

## 6. Marco 3 — Produtos, estoque, códigos e imagens

### Pré-requisitos

M2; decidir D02, D07 e D11 para aceite integral. A geração/leitura de código é solicitada, mas modelo por exemplar e simbologia não são conhecidos. Submeter biblioteca compatível à aprovação; não instalar scanner/gerador por iniciativa própria.

### Tarefas e dependências

| ID | Tarefa técnica | Depende de |
|---|---|---|
| M3.1 | CRUD products com FKs, Zod, filtros por nome/categoria/setor/fornecedor e busca | M2 |
| M3.2 | Entrada/ajuste de estoque por comando SQL autorizado + operations na mesma transação; definir histórico mínimo | D07, M3.1 |
| M3.3 | Aprovar representação de códigos; migration incremental se necessária; geração/leitura/validação de quantidade de exemplares | D02, M3.1 |
| M3.4 | Bucket privado, RLS storage.objects, upload/validação/compensação e image_path | D11, M3.1 |
| M3.5 | Implementar /product-codes, grants protegendo qtd e teste de tentativa direta de alteração | M3.2–4 |
| M3.6 | Testes de filtros, estoque, imagens, códigos; preview | M3.5 |

### Aceite verificável

- Cadastros referenciam entidades válidas; filtros retornam dados consistentes, incluindo ausência de vínculos opcionais.
- Quantidade não fica negativa. USER não altera qtd em UPDATE/INSERT direto; ajuste autorizado gera histórico e rollback integral quando o histórico falha.
- Imagem permitida é acessível somente a quem pode ler produto; arquivo inválido/acesso indevido negado; falha de associação não deixa órfão sem reconciliação.
- Código preserva zeros à esquerda; não existe colisão segundo regra aprovada; leitura/geração reproduzível em dispositivo de teste acordado.
- Múltiplos códigos e disponibilidade correspondem ao contrato D02; se D02 não for decidido, mostrar stub/TODO e marcar **aceite parcial**, nunca geração/leitura concluídas.

## 7. Marco 4 — Chaves e carros

### Tarefas e dependências

| ID | Tarefa técnica | Depende de |
|---|---|---|
| M4.1 | Confirmar D06/D12: significado de car_keys e indisponibilidade manual; aprovar validação de odômetro | M1/M2; sequência após M3 |
| M4.2 | CRUD keys e car_keys com formulários Zod, filtros e status visível | M4.1 |
| M4.3 | Proteger status/mileage por grants/comandos; bloquear exclusão referenciada | M4.2, políticas M1 |
| M4.4 | Revisar distance gerada; testar migração e constraints com dados sintéticos, sem valor negativo enquanto aberto | D06, M4.3 |
| M4.5 | Testes CRUD/permissões/disponibilidade e preview | M4.4 |

### Aceite verificável

- ADMIN/USER autorizado mantém os cadastros; USER sem K/V é negado por chamada direta.
- Status é exibido a partir do banco; CRUD não permite liberar um recurso emprestado.
- Mileage inválida e km negativo são recusados conforme contrato; nenhuma placa/CNH/combustível é adicionada fora de escopo.
- Recurso referenciado não é apagado; distance de empréstimo sem entrega permanece NULL conforme proposta aprovada.
- Concorrência real de empréstimos é comprovada no Marco 5; não declarar essa garantia só pelo CRUD deste marco.

## 8. Marco 5 — RPCs de empréstimo e devolução

**Situação atual:** início autorizado após homologação do Marco 4. Etapa 1 entrega as seis RPCs e bloqueios DML na 0009, com teste SQL e runner concorrente ainda não executados por instalação PostgreSQL incompleta. Etapa 2 (/home) não iniciada. D02 mantém estoque agregado; D03 devolução integral. Cliente aprovou colaborador obrigatório nos novos empréstimos, datas efetivas do servidor separadas do legado e UUID de idempotência por operador. Contratos completos em `C:\Projetos\Uniguacu\docs\MARCO-5-BACKEND.md`.

### Pré-requisitos

M2–M4, matriz aprovada e D03–D06/D12/D13 resolvidos para os fluxos correspondentes. Definir se empréstimo permite acadêmico, parcial/faltantes, sem devolução, datas/fuso e códigos. Desconhecidos permanecem bloqueados explicitamente; não avançar o aceite de um fluxo sem contrato.

### Tarefas e dependências

| ID | Tarefa técnica | Depende de |
|---|---|---|
| M5.1 | Refinar contratos e constraints dos três empréstimos, operador do banco, datas e vínculo operations | Pré-requisitos |
| M5.2 | Implementar lend_product e return_product com locks, escopo, histórico e estoque atômicos | M5.1, M3 |
| M5.3 | Implementar lend_key/return_key e lend_car/return_car; UNIQUE parcial ativo; fórmula e odômetro | M5.1, M4 |
| M5.4 | Privilégios EXECUTE, search_path, autorização dentro das RPCs, validação de destinatário e idempotência aprovada | M5.2–3 |
| M5.5 | Home: formulários, tabelas, filtros/estados conhecidos, confirmação de devolução e erros recuperáveis | M5.4 |
| M5.6 | Integração SQL, falha injetada, concorrência em sessões independentes, E2E | M5.5 |

### Aceite verificável

- Empréstimo com quantidade insuficiente falha; lendies, operations e products.qtd permanecem exatamente como antes.
- Falha em operations reverte também empréstimo, estoque/status, odômetro e códigos envolvidos, conforme fluxo.
- Duas sessões disputando última unidade permitem apenas o consumo disponível; dois empréstimos simultâneos da mesma chave/carro deixam só um ativo.
- Devolução repõe somente o delta aceito; reenvio ou devolução simultânea não incrementa duas vezes.
- Carro: km_in menor que km_out é negado; entrega válida atualiza distância, odômetro, status e histórico atomicamente.
- USER sem can_lend/can_return é negado diretamente pela RPC. USER não devolve linha fora do escopo; false/NULL/JSON inválido não libera operação.
- INSERT/UPDATE/DELETE diretos em empréstimos/operations não contornam os comandos, inclusive para ADMIN do aplicativo.
- Sem devolução, parcial/faltantes e códigos seguem decisões aprovadas; se bloqueados por TODO, registrar explicitamente o recurso não entregue.
- E2E login → empréstimo → devolução → consulta de histórico passa; relatório exportado é verificado no Marco 6-B.

## 9. Marco 6 — Histórico, administração, perfil, ajuda e relatórios

### M6-A — Conclusão do núcleo/MVP

| ID | Tarefa técnica | Depende de |
|---|---|---|
| M6.1 | Histórico operations somente leitura, próprio para USER e geral para ADMIN, filtros aprovados e snapshots mínimos | M5 |
| M6.2 | /admin e criação/edição em /admin/users; aliases /admin-create-user e /admin-edit-user; BFF Auth Admin com gate SQL, compensação e proteção de último ADMIN | M1, D08 |
| M6.3 | /perfil: nome/foto, confirmação de email, senha e exclusão conforme retenção aprovada | M1, D08/D11 |
| M6.4 | /help: manual baseado apenas nos fluxos entregues; revisão dos 33 mapeamentos e aliases de edição sem id | M6.1–3 |
| M6.5 | Regressão, verificação RLS/Storage e aceite do MVP | M6.1–4 |

### M6-B — Relatórios pós-núcleo

| ID | Tarefa técnica | Depende de |
|---|---|---|
| M6.6 | Aprovar D10: relatórios operacionais/gerais, colunas/filtros e amostras sintéticas; aprovar bibliotecas PDF/XLSX | M6-A |
| M6.7 | Consultas/exportadores server-side com gates SQL, limites/paginação e escopo preservado; tratar conteúdo de planilha que possa virar fórmula | M6.6 |
| M6.8 | E2E login → empréstimo → devolução → relatório; testes de permissão e conteúdo exportado | M6.7 |

### Aceite verificável

- ADMIN cria conta/perfil e altera role/permissões; USER recebe negação no endpoint e na rotina SQL, inclusive forjando requesterUid ou role no corpo.
- Falha de perfil/permissões após Auth cria estado seguro/reconciliável, nunca administrador indevido; nenhum segredo é retornado.
- Perfil próprio não permite alteração direta de role/limited_access/email não confirmado; email confirmado sincroniza sem divergência silenciosa.
- Exclusão não apaga histórico; última conta ADMIN não pode desaparecer por duas ações concorrentes se essa proposta for aprovada.
- Histórico não aceita mutação por cliente e apresenta somente escopo autorizado; revisão do help não inclui recurso ainda stub.
- PDF e XLSX abrem e conferem com amostra aprovada; valores/totais e filtros correspondem ao banco e ao escopo.
- USER com can_view_reports=false não exporta; com true exporta só operacional autorizado. Mesmo USER com todas as flags não lê relatório geral por acesso direto.
- O MVP é aceito em M6-A; M6-B tem aceite próprio, evitando tratar relatórios como pré-requisito retroativo do núcleo. Dashboard gráfico/importação continuam fora dos seis marcos.

## 10. Definição de Pronto (DoD) comum a todos os marcos

Um marco só está concluído quando:

1. Requisitos do marco e decisões relacionadas estão registrados; nenhum TODO bloqueante é ocultado. Redução de escopo depende de aceite expresso.
2. Código segue convenções aprovadas, revisão concluída e diff limitado ao escopo; sem alteração de artefatos legados ou dados pessoais da captura.
3. Typecheck, lint, build, testes unitários/integração/E2E relevantes passam em execução reproduzível; comando, ambiente e resultado registrados.
4. Testes negativos de autorização usam anon/USER/ADMIN e chamadas diretas; RLS verificado manualmente com identidade não privilegiada. Nenhuma prova baseada apenas em esconder botão.
5. Migrations incrementais são revisadas e testadas em banco isolado; preflight/saneamento/backup/reversão documentados. As 13 tabelas/UUIDs e dados existentes são preservados.
6. Grants por coluna, EXECUTE, owner de funções, search_path, policies de Storage e possíveis caminhos de bypass são revisados conforme o marco.
7. Preview Vercel está disponível e testado, com banco/Storage não produtivos e variáveis separadas. Link de preview registrado no PR; não publicado nesta fase.
8. Erros/empty/loading states, navegação por teclado e responsividade mínima são validados; mensagens não expõem SQL interno, tokens ou dados alheios.
9. Sem segredo versionado/no bundle/logs; apenas configuração pública autorizada chega ao navegador.
10. Diretoria/TI ou responsável designado dá aceite com evidências; pendências não bloqueantes têm responsável e destino definidos.

## 11. Validação e operação planejadas

Scripts existentes em `C:\Projetos\Uniguacu\package.json`: `lint`, `typecheck`, `build` e `test` (Node nativo). `test:e2e` e comando de integração SQL ainda não estão configurados como scripts npm. Testes SQL em `C:\Projetos\Uniguacu\supabase\tests\` exigem ambiente isolado e não são comprovados pelos testes com mocks/inspeção textual. CI sem credencial de produção; testes de Auth/Storage somente com fixtures e limpeza restrita ao ambiente de teste.

Para banco, testar baseline + refinamentos tanto em ambiente limpo de teste quanto em cópia sanitizada com dados/constraints existentes. Não usar `db reset` no projeto hospedado. Concorrência precisa de pelo menos duas conexões reais. Falha injetada não vai para produção.

Antes de release produtivo: autorização específica, revisão do diff/migrations, restauração ensaiada, responsáveis por Auth/Storage/Vercel/GitHub e procedimento de rollback. Backup, retenção e operação não são presumidos pela existência de deploy vinculado.

## 12. Gates de aprovação

| Gate | Evidência exigida | Resultado |
|---|---|---|
| G0 — documentos | Revisão deste plano/PDD e matriz proposta | “Ok” explícito autoriza iniciar somente Marco 1, não executar SQL em produção. |
| G1 — contrato mínimo | Decisões D01/D08/D09 aplicáveis ao Marco 1, versões/dependências e ambiente seguro | Sem isso, alinhar antes de scaffold/migration. |
| G2 — por marco | Critérios específicos + DoD + TODOs resolvidos ou redução de escopo aprovada | Avançar para o próximo marco. |
| G3 — MVP | M6-A e regressão operacional completos | Núcleo apto a homologação/release autorizado. |
| G4 — relatórios | D10, M6-B e autorização de exportação verificados | Evolução funcional entregue. |

**Situação atual:** Marcos 1–4 concluídos; Marco 4 homologado com 0007/0008 aplicadas pelo cliente. Marco 5 iniciado somente no backend (0009), sem interface; execução SQL real e homologação das RPCs pendentes. Nenhuma execução remota, instalação de dependência ou deploy pelo agente nesta etapa. Marco 5 não deve ser declarado concluído antes dos testes reais de banco/concorrência e da etapa 2.