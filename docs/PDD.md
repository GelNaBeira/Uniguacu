# PDD — Almoxarifado Uniguacu, Foz do Iguaçu

**Estado:** aprovado pelo cliente; Fase 3 autorizada somente para início do Marco 1 em 11/11/2026. Decisões MVP e limites de implementação registrados em `C:\Projetos\Uniguacu\docs\MARCO-1.md`.  
**Entregável:** Fase 1 — Documento de Design do Produto.  
**Fontes funcionais:** `C:\Projetos\Uniguacu\docs\MAPA-FUNCIONAL.md`, especialmente “Mapa de telas”, “Modelo de dados”, “Papéis e permissões” e “Fluxos principais”; requisitos desta solicitação e resposta do cliente autorizando uma proposta de permissões.  
**Baseline local:** `C:\Projetos\Uniguacu\supabase\migrations\0001_initial_schema.sql`. Não houve consulta ao banco remoto; schema instalado, dados e políticas efetivas ainda precisam ser confrontados com essa baseline.

## 1. Evidências, escopo e limites

- **[confirmado no mapa]**: evidência da análise estática, não garantia de funcionamento em produção.
- **[inferido no mapa]**: conceito identificado em nomes/labels, sem contrato persistido comprovado.
- **[desconhecido] / TODO**: não há regra recuperada; não implementar comportamento silenciosamente.
- **[baseline]**: definição existente no SQL local; não prova equivalência com o legado.
- **[proposta — a validar]**: escolha nova de arquitetura/segurança ou regra sugerida. Aprovação deste PDD deve registrar quais propostas foram aceitas.
- **“a confirmar com o cliente”**: coluna nova ou semântica dependente de decisão operacional.

A autorização do cliente para propor a matriz não confirma as demais regras desconhecidas. Nenhum nome de tabela será trocado; todas as PKs continuam UUID. Não haverá tentativa de recuperar dados ou acessar o Firebase perdido.

### 1.1 Objetivo

Reconstruir autenticação, cadastros, gestão de estoque e empréstimos com Next.js App Router/TypeScript, Tailwind/shadcn/ui, Supabase Auth/PostgreSQL/Storage, BFF e deploy Vercel. GitHub informado pelo cliente: `GelNaBeira/Uniguacu`; vínculo remoto não verificado nesta fase.

### 1.2 MVP e evolução

| Entrega | Conteúdo | Limite |
|---|---|---|
| MVP operacional | Login/logout/recuperação, perfil, administração de usuários, layout autenticado, manutenção das 13 entidades, busca/filtros, produtos/códigos, chaves/carros, empréstimos/devoluções atômicos, histórico consultável, ajuda | CRUD não significa permitir edição arbitrária de estoque, histórico ou empréstimos. Nessas entidades, comandos de negócio substituem mutações livres. Funcionalidades com TODO ficam bloqueadas com explicação. |
| Evolução funcional após o núcleo | Relatórios PDF/Excel no Marco 6 | ADMIN para relatórios gerais; USER somente relatórios operacionais aprovados. |
| Backlog posterior aos seis marcos | Dashboard com gráficos; importação em massa | Não há contrato funcional suficiente no mapa. Sem rotas, formatos, bibliotecas ou entregas inventadas. |

“Fase 2” neste projeto significa o plano documental, não implementação de relatórios. “Evolução funcional” distingue o escopo posterior ao MVP. O Marco 6 contém a conclusão do MVP (histórico/admin/perfil/help) e uma etapa separada de relatórios pós-núcleo. Não criar dashboard analítico no Marco 1; Home é a operação de empréstimos do mapa.

## 2. Arquitetura e fronteiras de segurança

```text
Navegador — Next.js: componentes interativos + chave pública
    | sessão do usuário
    +--> BFF / Server Components / Server Actions — validação e resposta
    |        +--> Supabase com identidade do usuário --> grants + RLS
    |        +--> Auth Admin, somente operações administrativas autorizadas
    +--> RPCs de negócio --> autorização no banco + locks + transação
    +--> Storage privado --> políticas storage.objects
PostgreSQL: integridade, estoque, disponibilidade e histórico
```

**Proposta:** middleware ajuda a navegar e renovar sessão, mas cada leitura/comando do servidor revalida a identidade; autorização lê o perfil atual no banco. Não confiar em `role`, `requesterUid` ou permissões enviados pelo cliente. Não usar metadados editáveis do Auth como autoridade. O cliente SSR deve seguir o guia oficial; `getSession()` isolado não é prova de identidade [T3].

Somente `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` são configuração pública da aplicação. `SUPABASE_SERVICE_ROLE_KEY` fica em módulo server-only e ambiente protegido, jamais em bundle, resposta, logs ou documentação. Operações normais usam sessão do usuário; service role não é o cliente padrão. Como uma chave privilegiada pode contornar RLS, Auth Admin exige autorização própria no BFF e um gate SQL restrito; RLS de `public.usuarios` não protege sozinho a API de Auth [T1, T4].

A versão exata do Next.js e das bibliotecas será fixada e testada no Marco 1, respeitando 14+ e suporte de segurança vigente. O caminho solicitado `middleware.ts` é alvo documental; se a versão aprovada exigir outra convenção, registrar a adaptação antes de implementar. Nenhuma dependência será instalada nesta fase.

## 3. Modelo relacional

### 3.1 Convenções de leitura do dicionário

- `NULL` significa permitido; `NN` significa `NOT NULL`; “—” significa sem default explícito.
- PK, UNIQUE e CHECK explicitados abaixo são da baseline, salvo indicação **P**.
- **B** = baseline local; **P** = refinamento proposto, ainda não aplicado.
- As 12 tabelas que não são `usuarios` têm `id uuid PK NN DEFAULT uuid_generate_v4()` (**B**). `usuarios.id` não tem geração independente do Auth.
- `created_at`, quando presente na baseline, é `timestamptz NULL DEFAULT now()`. **P:** torná-lo NN após diagnóstico/backfill, sem inventar datas históricas; campos de negócio novos não recebem valores fictícios.
- Enums **B**: `user_role(ADMIN, USER)`, `item_status(DISPONIVEL, INDISPONIVEL)`, `lend_status(EM_ANDAMENTO, ATRASADO, DEVOLVIDO, SEM_DEVOLUCAO)`. **TODO:** critério de atraso e significado de data prevista versus data efetiva.
- FKs da baseline, salvo `usuarios.id`, usam comportamento padrão `ON DELETE NO ACTION`. **P:** preservá-lo para impedir exclusão de referências em uso; não adotar cascade no domínio sem aprovação.
- Índices PK/UNIQUE já são criados pelas constraints. Índices de FK e filtros abaixo são **P**; validar com consultas e volume antes da migração.

### 3.2 `usuarios`

| Coluna | Tipo / restrições B | Default B | Origem / proposta |
|---|---|---|---|
| id | uuid PK NN, FK auth.users(id), ON DELETE CASCADE | — | Perfil do mesmo usuário autenticado. |
| email | text UNIQUE NN | — | Confirmado no mapa; sincronizar com Auth apenas após confirmação efetiva. |
| name | text NN | — | Confirmado. |
| role | user_role NN | 'USER' | Papéis confirmados; nunca aceitar role privilegiado de signup público. |
| limited_access | jsonb NULL | '{}'::jsonb | Existência confirmada; formato legado desconhecido. Estrutura proposta na seção 4. |
| photo_url | text NULL | — | Mapa confirma photo como Data URL; URL/path é adaptação ao Storage. |
| created_at | timestamptz NULL | now() | Técnico B; não comprovado no legado. |

**P:** `limited_access NN`, CHECK de objeto, versão e chaves booleanas conhecidas; validar valores existentes antes de normalizar. `name` não vazio. `photo_url` passa a guardar caminho do objeto, não URL pública permanente; URLs assinadas são transitórias. **A confirmar com o cliente.** Identificação do usuário é inferida no mapa: `identification text NULL` é candidata, **a confirmar com o cliente**, não implementada até confirmação de necessidade/formato.

Índices P: `role` se necessário para manutenção dos administradores. Email já UNIQUE; comparação case-insensitive exige saneamento e decisão antes de substituir constraint. Não criar GIN no JSON sem consulta que o justifique. Vínculos: `operations.user_id` e proposta de operador nos empréstimos. Não equiparar colaborador a usuário.

### 3.3 `categories`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| name | text UNIQUE NN | — | Nome inferido no mapa. |

P: CHECK nome não vazio; preservar unicidade atual. Referenciada por `products.category_id`; exclusão com referência bloqueada. Índice de nome já existe pelo UNIQUE; busca por trecho só ganha índice específico se medido.

### 3.4 `sectors`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| name | text UNIQUE NN | — | Nome inferido. |

P: CHECK nome não vazio. Referenciada por `products.sector_id`; preservar bloqueio de exclusão quando referenciada. Índice de nome já existe.

### 3.5 `suppliers`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| fantasy_name | text NN | — | Label inferido. |
| legal_name | text NULL | — | Label inferido. |
| cnpj_cpf | text NULL | — | Label inferido; não presumir validade ou unicidade. |
| created_at | timestamptz NULL | now() | Técnico. |

P: nome fantasia não vazio; índice `fantasy_name`. Não converter CPF/CNPJ em número. Normalização, máscara, dígitos verificadores e eventual UNIQUE são TODO de validação. Referenciada por `products.supplier_id`.

### 3.6 `collaborators`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| name | text NN | — | Inferido. |
| identification | text NULL | — | Inferido; formato desconhecido. |
| role_function | text NULL | — | Função inferida, não é papel de autorização. |
| phone | text NULL | — | Inferido. |

P: nome não vazio, índice `name`; sem unicidade em identificação até confirmação. Referenciada pelos três empréstimos. Não adicionar FK a usuarios sem evidência.

### 3.7 `academics`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| name | text NN | — | Inferido. |
| ra | text NULL | — | Inferido; regras desconhecidas. |
| course | text NULL | — | Inferido. |

P: nome não vazio, índice `name`; índice não único `ra` se usado na busca. Não presumir RA único. **TODO:** acadêmicos podem receber quais empréstimos? O schema atual não os referencia; não inventar vínculo polimórfico. Possível `academic_id uuid NULL FK academics(id)` nos empréstimos e CHECK de destinatário exclusivo é **a confirmar com o cliente**, não parte aprovada da migração.

### 3.8 `products`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| name | text NN | — | Confirmado. |
| qtd | integer NN, CHECK qtd >= 0 | 0 | Confirmado; P: quantidade disponível, a validar. |
| price | numeric(12,2) NULL | — | Preço unitário inferido. |
| bar_code | text NULL | — | Conceito barCode confirmado; estrutura individual desconhecida. |
| note_id | text NULL | — | Identificação da nota inferida; não é FK conhecida. |
| description | text NULL | — | Inferido. |
| has_barcode | boolean NULL | false | Conceito de interface; coluna B não comprova regra. |
| category_id | uuid NULL FK categories(id) | — | Relação inferida. |
| sector_id | uuid NULL FK sectors(id) | — | Relação inferida. |
| supplier_id | uuid NULL FK suppliers(id) | — | Relação inferida. |
| created_at | timestamptz NULL | now() | Técnico. |

P: nome não vazio; `price IS NULL OR price >= 0`; `has_barcode NN` após saneamento. Nova `image_path text NULL DEFAULT NULL`, caminho em bucket privado, **a confirmar com o cliente**: upload de produto pedido nesta solicitação, não fluxo confirmado no mapa.

Índices P: `name`, `category_id`, `sector_id`, `supplier_id`; não tornar `bar_code` UNIQUE antes de decidir se é código de tipo de produto ou exemplar. `lendies.product_id` aponta para produto.

**TODO bloqueante de códigos:** mapa descreve múltiplos códigos e disponibilidade por exemplar; `bar_code text` sozinho não representa isso. Opções a submeter: JSONB estruturado no produto mantendo as 13 tabelas, ou tabela adicional normalizada com UUID e vínculos de exemplar. Não criar uma 14ª tabela nem sobrescrever `bar_code` sem aprovação. Até decidir, stub explícita para geração/leitura e empréstimo com código individual; produtos sem códigos podem avançar. Simbologia, hardware/câmera, impressão e formato de geração não são conhecidos. Não escolher bibliotecas silenciosamente.

### 3.9 `keys`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| name | text NN | — | Inferido. |
| status | item_status NN | 'DISPONIVEL' | Status confirmado, codificação nova da baseline. |

P: nome não vazio; índice `name`; composto `(status, name)` se filtro justificar. Referenciada por `key_lends.key_id`. Status não pode ser livremente marcado disponível durante empréstimo ativo. Bloqueio manual de indisponibilidade precisa de decisão para distinguir manutenção de empréstimo.

### 3.10 `car_keys`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| name | text NN | — | Nome inferido. |
| mileage | integer NULL | 0 | Quilometragem inferida. |
| status | item_status NN | 'DISPONIVEL' | Status confirmado; enum B. |

P: nome não vazio, `mileage >= 0` quando não NULL; NN apenas se cliente confirmar obrigatoriedade/unidade inteira. Índices `name`, eventualmente `(status, name)`. Referenciada por `car_key_lends.car_key_id`. **TODO:** representa carro, chave ou ambos? Manter nome da tabela e label “Carro” do mapa, sem adicionar placa, combustível, CNH ou manutenção.

### 3.11 `lendies`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Grafia preservada. |
| product_id | uuid NN FK products(id) | — | Produto é conceito inferido. |
| collaborator_id | uuid NULL FK collaborators(id) | — | Destinatário inferido; obrigatoriedade pendente. |
| quantity | integer NN, CHECK > 0 | — | Quantidade inferida. |
| out_date | date NN | — | Data de saída inferida. |
| out_time | time NULL | — | Hora inferida. |
| return_date | date NULL | — | Semântica prevista/efetiva desconhecida. |
| return_time | time NULL | — | Hora inferida. |
| no_return | boolean NULL | false | Condição sem devolução na interface. |
| out_observation | text NULL | — | Inferido. |
| return_observation | text NULL | — | Inferido. |
| status | lend_status NULL | 'EM_ANDAMENTO' | Estados visuais confirmados, transições não. |
| created_at | timestamptz NULL | now() | Técnico. |

Propostas novas, todas **a confirmar com o cliente**:

| Coluna P | Tipo / restrições / default | Justificativa |
|---|---|---|
| created_by | uuid NN FK usuarios(id), sem default declarativo; RPC usa auth.uid() | Delimitar histórico próprio e identificar operador. Backfill desconhecido bloqueia NN em registros legados. |
| returned_quantity | integer NN DEFAULT 0, CHECK entre 0 e quantity | Quantidade devolvida existe na interface; devolução parcial não está confirmada. |
| returned_at | timestamptz NULL DEFAULT NULL | Separar devolução efetiva de datas de semântica ambígua. |
| due_at | timestamptz NULL DEFAULT NULL | Somente se return_date for prevista; habilita atraso depois de confirmar regra. |

P: `status NN`, `no_return NN`; índices `product_id`, `collaborator_id`, `(created_by, created_at DESC)`, `(status, out_date)`. Não usar UNIQUE de produto ativo: vários empréstimos podem consumir partes do estoque. Sem DELETE/UPDATE arbitrários, inclusive ADMIN. Consumíveis, faltantes e encerramento parcial são TODO; MVP propõe devolução integral única, mas só habilita esse contrato após validação.

### 3.12 `key_lends`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| key_id | uuid NN FK keys(id) | — | Relação inferida. |
| collaborator_id | uuid NULL FK collaborators(id) | — | Inferido. |
| out_date | date NN | — | Inferido. |
| return_date | date NULL | — | Semântica desconhecida. |
| status | lend_status NULL | 'EM_ANDAMENTO' | Codificação B. |
| created_at | timestamptz NULL | now() | Técnico. |

P, **a confirmar com o cliente**: `created_by uuid FK usuarios(id)` (NN somente após saneamento); `out_time time NULL`, `return_time time NULL`, `out_observation text NULL`, `return_observation text NULL`, `returned_at timestamptz NULL`, todos sem default; completam conceitos inferidos que faltam na baseline. `status NN` após diagnóstico.

Índices P: FKs `key_id`, `collaborator_id`, `(created_by, created_at DESC)`, `(status, out_date)`; UNIQUE parcial em `key_id WHERE status IN ('EM_ANDAMENTO','ATRASADO')`. Validar significado de ativo antes de aplicá-lo; registros inconsistentes impedem a migração, não devem ser apagados automaticamente.

### 3.13 `car_key_lends`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| car_key_id | uuid NN FK car_keys(id) | — | Inferido. |
| collaborator_id | uuid NULL FK collaborators(id) | — | Inferido. |
| out_date | date NN | — | Inferido. |
| return_date | date NULL | — | Semântica desconhecida. |
| km_out | integer NULL | — | Inferido. |
| km_in | integer NULL | — | Inferido. |
| distance | integer GENERATED ALWAYS AS (coalesce(km_in,0) - coalesce(km_out,0)) STORED | expressão | Fórmula B, não confirmada pelo mapa. Pode gerar negativo antes da devolução. |
| status | lend_status NULL | 'EM_ANDAMENTO' | Codificação B. |
| created_at | timestamptz NULL | now() | Técnico. |

P, **a confirmar com o cliente**: substituir expressão gerada de `distance` por `CASE WHEN km_in IS NULL OR km_out IS NULL THEN NULL ELSE km_in - km_out END`; preservar nome/tipo e dependências; CHECK `km_out >= 0`, `km_in IS NULL OR km_in >= km_out`. Campos novos como em `key_lends`: `created_by uuid FK usuarios(id)`, `out_time time`, `return_time time`, `out_observation text`, `return_observation text`, `returned_at timestamptz`, todos NULL/sem default inicialmente. NN do operador/status/odômetro de saída depende de saneamento e aceite.

Índices P: FKs, `(created_by, created_at DESC)`, `(status, out_date)`; UNIQUE parcial `car_key_id WHERE status IN ('EM_ANDAMENTO','ATRASADO')`. Fórmula proposta: entrega menos retirada, sem distância negativa; atualização do odômetro na devolução é proposta explícita, não fato do legado. Unidade e tratamento de correção de odômetro são TODO.

### 3.14 `operations`

| Coluna | Tipo / restrições B | Default B | Origem |
|---|---|---|---|
| id | uuid PK NN | uuid_generate_v4() | Técnico. |
| operation_type | text NN | — | Tipo inferido; vocabulário não recuperado. |
| description | text NULL | — | Conceitos do relatório inferidos. |
| user_id | uuid NULL FK usuarios(id) | — | Operador B, não confirmado no mapa. |
| created_at | timestamptz NULL | now() | Técnico. |

P, **a confirmar com o cliente**: `lend_id uuid NULL FK lendies(id)`, `key_lend_id uuid NULL FK key_lends(id)`, `car_key_lend_id uuid NULL FK car_key_lends(id)`, sem defaults; CHECK no máximo um vínculo, ou exatamente um para tipos de empréstimo; `details jsonb NN DEFAULT '{}'::jsonb` para snapshot mínimo de produto/classificações/quantidades e valores necessários aos relatórios. Snapshot é proposta para não reescrever história quando cadastro mudar; conteúdo exato depende dos relatórios aprovados. Não armazenar senhas/tokens ou cópias indiscriminadas de dados pessoais.

P: `user_id` preenchido pelo banco nos eventos novos; índices `(user_id, created_at DESC)`, `(operation_type, created_at DESC)` e FKs novas. Escrita apenas por rotinas de negócio; sem UPDATE/DELETE pelo aplicativo. Não prometer auditoria inviolável contra owner/service role. Exclusão física de usuarios é bloqueada pela FK quando houver operações: tratamento de retenção/anonimização é TODO, não acrescentar `ON DELETE CASCADE` no histórico.

### 3.15 Relacionamentos resumidos e migração

```text
auth.users 1 — 1 usuarios 1 — N operations
categories/sectors/suppliers 1 — N products 1 — N lendies
collaborators 1 — N lendies / key_lends / car_key_lends
keys 1 — N key_lends; car_keys 1 — N car_key_lends
usuarios 1 — N empréstimos (created_by: proposta)
empréstimos 1 — N operations (FKs novas: proposta)
academics: cadastro independente; relação com empréstimos TODO
```

Antes da futura `0002_refinements.sql`: comparar catálogo remoto à baseline, contar NULLs/duplicatas/órfãos, revisar constraints/índices/geração de distance, obter backup e plano de reversão. Não recriar as 13 tabelas, não transformar identificadores em inteiros, não preencher responsáveis/datas fictícias. Validar constraints após saneamento aprovado. SQL desta documentação é especificação de design, não migração pronta para executar.

## 4. Proposta de Matriz de Permissões — A Validar com a Diretoria/TI

### 4.1 Regras propostas

ADMIN administra o sistema, mas não contorna integridade: empréstimos são comandos transacionais, histórico não é editável e dados referenciados não são apagados livremente. USER tem leitura operacional e cadastros básicos; exclusão e relatórios são restritos. Permissões não concedem poderes administrativos. Nenhum anônimo acessa as 13 tabelas.

Proposta de `limited_access` para um USER criado pela administração:

```json
{
  "version": 1,
  "can_read_inventory": true,
  "can_manage_catalogs": true,
  "can_manage_products": true,
  "can_manage_keys": true,
  "can_manage_cars": true,
  "can_lend": true,
  "can_return": true,
  "can_delete": false,
  "can_view_reports": false,
  "can_view_all_lends": false
}
```

**A validar:** defaults acima expressam “USER faz o básico”. `{}` legado não concede esses acessos: chave ausente, NULL, tipo incorreto, versão desconhecida ou perfil inexistente resulta em negação. Novos perfis USER recebem o documento completo aprovado; perfis existentes exigem revisão, nunca concessão automática. Apenas ADMIN muda permissões/role; ADMIN ignora flags, sem ignorar invariantes. Chaves não conhecidas são rejeitadas na escrita. Versão é número inteiro 1; demais chaves são booleanos reais, nunca strings.

`can_read_inventory` é pré-requisito das permissões operacionais. `can_view_reports` permite apenas relatório operacional derivado das linhas já visíveis; não libera relatórios gerais nem todos os empréstimos. `can_view_all_lends` amplia empréstimos operacionais visíveis, não usuários nem histórico geral. `can_delete` só permite apagar cadastros sem referências; não empréstimos, contas alheias ou operations.

### 4.2 Contratos dos auxiliares SQL (design; implementação na Fase 3)

Auxiliares no schema privado não exposto `private`, sem argumento de identidade fornecido pelo cliente:

- `private.is_admin() -> boolean`: verifica `auth.uid()` no perfil e role ADMIN; false sem identidade/perfil.
- `private.has_permission(flag text) -> boolean`: somente perfil USER válido com versão/chave conhecida e valor JSON boolean true; false para qualquer outro caso.
- Ambos consultam perfil atual, não uma role antiga em JWT/localStorage. Para evitar recursão da RLS de usuarios, a implementação proposta é SECURITY DEFINER mínima, owner controlado, `SET search_path = ''`, nomes qualificados, sem SQL dinâmico, sem retornar perfis arbitrários. Revogar execução de PUBLIC/anon, conceder estritamente o necessário a authenticated, sem CREATE no schema para clientes [T1, T2].

Notação das expressões abaixo (expandir literalmente na implementação):

```sql
-- A
private.is_admin()
-- R
private.has_permission('can_read_inventory')
-- C, P, K, V (catálogos, produtos, chaves, carros)
private.has_permission('can_read_inventory') AND private.has_permission('can_manage_catalogs')
private.has_permission('can_read_inventory') AND private.has_permission('can_manage_products')
private.has_permission('can_read_inventory') AND private.has_permission('can_manage_keys')
private.has_permission('can_read_inventory') AND private.has_permission('can_manage_cars')
-- D(X): expressão X AND private.has_permission('can_delete')
-- L: expressão por linha nas três tabelas de empréstimos
private.has_permission('can_read_inventory') AND
(created_by = (SELECT auth.uid()) OR private.has_permission('can_view_all_lends'))
-- O: histórico operacional próprio; eventos gerais não ficam acessíveis
private.has_permission('can_read_inventory') AND
user_id = (SELECT auth.uid()) AND
operation_type IN ('PRODUCT_LEND','PRODUCT_RETURN','KEY_LEND','KEY_RETURN','CAR_LEND','CAR_RETURN')
-- S: próprio perfil
id = (SELECT auth.uid())
-- N: negar acesso direto
false
```

Tipos de operação acima são **proposta**, não vocabulário legado. Ausência de `created_by` na baseline impede habilitar L até o refinamento aprovado.

### 4.3 Matriz completa por entidade, operação e papel

Cada célula contém a expressão SQL da política para **acesso direto** por `authenticated`. `A`, `R`, etc. são as expansões da seção 4.2; `N` é `false`. RLS é complementada por grants de coluna/rotinas, descritos a seguir. Não existe papel PostgreSQL ADMIN/USER separado: são valores do perfil, avaliados dentro da política.

| Entidade | ADMIN SELECT | ADMIN INSERT | ADMIN UPDATE | ADMIN DELETE | USER SELECT | USER INSERT | USER UPDATE | USER DELETE |
|---|---|---|---|---|---|---|---|---|
| usuarios | A | N | N | N | S | N | N | N |
| categories | A | A | A | A | R | C | C | D(C) |
| sectors | A | A | A | A | R | C | C | D(C) |
| suppliers | A | A | A | A | R | C | C | D(C) |
| collaborators | A | A | A | A | R | C | C | D(C) |
| academics | A | A | A | A | R | C | C | D(C) |
| products | A | A | A | A | R | P | P | D(P) |
| keys | A | A | A | A | R | K | K | D(K) |
| car_keys | A | A | A | A | R | V | V | D(V) |
| lendies | A | N | N | N | L | N | N | N |
| key_lends | A | N | N | N | L | N | N | N |
| car_key_lends | A | N | N | N | L | N | N | N |
| operations | A | N | N | N | O | N | N | N |

**Por que ADMIN não tem INSERT/UPDATE/DELETE direto em tudo?** Administração de contas ocorre via Auth e gates SQL; empréstimos via RPC; operations é append-only. “ADMIN faz tudo” significa comandos permitidos do sistema, não poder violar consistência. É melhoria de segurança proposta, sujeita à aprovação.

### 4.4 SQL correspondente às células

Para cada linha/coluna da matriz haverá política nomeada por tabela, operação e perfil, com as expressões literais expandidas. Especificação SQL:

```sql
-- SELECT: expressão da célula no USING
CREATE POLICY categories_select_admin ON public.categories
FOR SELECT TO authenticated USING (private.is_admin());
CREATE POLICY categories_select_user ON public.categories
FOR SELECT TO authenticated USING (private.has_permission('can_read_inventory'));

-- INSERT: expressão da célula no WITH CHECK
CREATE POLICY categories_insert_user ON public.categories
FOR INSERT TO authenticated WITH CHECK (
  private.has_permission('can_read_inventory') AND
  private.has_permission('can_manage_catalogs')
);

-- UPDATE: mesma expressão para linha anterior e posterior
CREATE POLICY categories_update_user ON public.categories
FOR UPDATE TO authenticated USING (
  private.has_permission('can_read_inventory') AND private.has_permission('can_manage_catalogs')
) WITH CHECK (
  private.has_permission('can_read_inventory') AND private.has_permission('can_manage_catalogs')
);

-- DELETE: expressão da célula no USING
CREATE POLICY categories_delete_user ON public.categories
FOR DELETE TO authenticated USING (
  private.has_permission('can_read_inventory') AND
  private.has_permission('can_manage_catalogs') AND
  private.has_permission('can_delete')
);
```

Esta regra de expansão cobre **todas as 104 células**, sem permissões implícitas:

| Operação da célula | Forma SQL obrigatória |
|---|---|
| SELECT | `CREATE POLICY <tabela>_select_<perfil> ON public.<tabela> FOR SELECT TO authenticated USING (<expressão>);` |
| INSERT | `CREATE POLICY <tabela>_insert_<perfil> ON public.<tabela> FOR INSERT TO authenticated WITH CHECK (<expressão>);` |
| UPDATE | `CREATE POLICY <tabela>_update_<perfil> ON public.<tabela> FOR UPDATE TO authenticated USING (<expressão>) WITH CHECK (<expressão>);` |
| DELETE | `CREATE POLICY <tabela>_delete_<perfil> ON public.<tabela> FOR DELETE TO authenticated USING (<expressão>);` |

Exemplo de N: `USING (false)` para DELETE ou `WITH CHECK (false)` para INSERT. Na migration, preferir ausência de política permissiva para N e revogar o grant; políticas permissivas são combinadas por OR, portanto uma política false não anula uma política antiga true [T1]. Remover nominalmente as políticas permissivas da baseline (`usuarios_select_auth`, `usuarios_admin_all`, `products_select_auth`, `products_write_auth`, `products_update_auth`) na migração revisada; inspecionar e reconciliar políticas adicionais remotas, não apagá-las cegamente.

### 4.5 Colunas sensíveis, RPCs e relatórios

- RLS protege linhas, não separa campos editáveis da mesma linha; grants de coluna e rotinas são necessários para proteger role/permissões e estoque [T1].
- `usuarios`: sem escrita direta de authenticated, inclusive no próprio perfil. `update_my_profile` aceita apenas nome/foto; `admin_update_user` modifica papel/permissões após gate ADMIN no banco. Campo email acompanha confirmação do Auth; senha jamais vai à tabela. Gate não aceita identidade alegada pelo navegador.
- `products`: INSERT/UPDATE direto somente campos de cadastro. Revogar grant global de INSERT/UPDATE antes dos grants por coluna; não conceder qtd, id ou created_at. Quantidade inicial/ajustes usam comando autorizado, com histórico atômico; contrato de ajuste, motivo e tipos de operations **a confirmar**. DEFAULT qtd=0 evita estoque inicial forjado. Aprovação desse comando é pré-requisito de entrada de estoque no MVP.
- `keys` e `car_keys`: grants de cadastro excluem status e, nas atualizações, mileage; comandos de negócio controlam disponibilidade/odômetro. Criação usa defaults seguros. Não permitir mudar id/operador/created_at nas entidades.
- RPC `lend_product`, `return_product`, `lend_key`, `return_key`, `lend_car`, `return_car`: EXECUTE para authenticated apenas; nega anon/PUBLIC. Gate: ADMIN ou USER com R e flag can_lend/can_return. Para devolver, USER precisa também enxergar a linha por L; autorizar devolução de empréstimo alheio exige `can_view_all_lends`. Nenhuma flag permite alterar o passado livremente.
- RPCs SECURITY DEFINER podem escrever onde cliente não pode: **não são protegidas automaticamente pela RLS quando o owner a contorna**. Cada função deve validar identidade, permissões atuais, escopo de linha e invariantes no banco antes de qualquer escrita; privilégios mínimos, search_path fixo e testes de chamada direta são obrigatórios [T1, T2].
- Relatórios gerais: somente rotina SQL ADMIN, EXECUTE restrito e gate interno `private.is_admin()`. USER nunca recebe acesso geral, mesmo com `can_view_reports=true` e `can_view_all_lends=true`. Relatório operacional exige R + can_view_reports e mantém os predicados de linhas L/O. Proibir views/exportadores que contornem essa filtragem.
- `can_delete` não contorna FKs; tentativa em cadastro referenciado retorna conflito legível. DELETE de auth.users não é acesso a public.usuarios: autorizar no servidor e bloquear no banco remoção incompatível com histórico. Retenção e último ADMIN precisam de aceite (seção 8).

### 4.6 Storage (proposta a validar)

Buckets privados `avatars` e `product-images`. Caminhos `avatars/<auth.uid()>/<uuid>` e `product-images/<product-id>/<uuid>`. Limites de tamanho/MIME permitidos serão aprovados no Marco 1/3, sem valores fictícios neste PDD. Validar conteúdo no servidor, não confiar só em extensão.

| Bucket | SELECT | INSERT / UPDATE | DELETE |
|---|---|---|---|
| avatars | dono ou ADMIN | dono ou ADMIN, prefixo obrigatório | dono ou ADMIN |
| product-images | ADMIN ou R | ADMIN ou P, produto existente | ADMIN ou P e can_delete |

Políticas em `storage.objects` verificam `bucket_id`, prefixo, identidade e permissões; update verifica USING e WITH CHECK para impedir mover objeto a prefixo alheio. Referência de perfil/produto só aceita objetos autorizados; URL assinada curta é emitida após autorização. Upload e alteração de linha não formam uma transação SQL única: usar compensação/reconciliação para objetos órfãos. Anexos adicionais ficam TODO: o mapa não define fluxo, dono ou retenção [T5].

## 5. Tradução das 33 rotas

Os caminhos de arquivo são relativos à raiz `C:\Projetos\Uniguacu\`. `(auth)` e `(app)` não fazem parte da URL. Para login, prevalece o grupo `(auth)` explicitamente solicitado; não criar simultaneamente `app/login/page.tsx`.

| # | Angular | Next.js URL | Arquivo App Router |
|---|---|---|---|
| 1 | / | / → /login | app/page.tsx |
| 2 | /login | /login | app/(auth)/login/page.tsx |
| 3 | /home | /home | app/(app)/home/page.tsx |
| 4 | /products | /products | app/(app)/products/page.tsx |
| 5 | /new-product | /products/new | app/(app)/products/new/page.tsx |
| 6 | /edit-product | /products/[id]/edit | app/(app)/products/[id]/edit/page.tsx |
| 7 | /product-codes | /product-codes | app/(app)/product-codes/page.tsx |
| 8 | /collaborators | /collaborators | app/(app)/collaborators/page.tsx |
| 9 | /new-collaborator | /collaborators/new | app/(app)/collaborators/new/page.tsx |
| 10 | /edit-collab | /collaborators/[id]/edit | app/(app)/collaborators/[id]/edit/page.tsx |
| 11 | /academics | /academics | app/(app)/academics/page.tsx |
| 12 | /new-academic | /academics/new | app/(app)/academics/new/page.tsx |
| 13 | /edit-academic | /academics/[id]/edit | app/(app)/academics/[id]/edit/page.tsx |
| 14 | /keys | /keys | app/(app)/keys/page.tsx |
| 15 | /new-key | /keys/new | app/(app)/keys/new/page.tsx |
| 16 | /edit-key | /keys/[id]/edit | app/(app)/keys/[id]/edit/page.tsx |
| 17 | /cars | /cars | app/(app)/cars/page.tsx |
| 18 | /new-car-key | /cars/new | app/(app)/cars/new/page.tsx |
| 19 | /edit-car-key | /cars/[id]/edit | app/(app)/cars/[id]/edit/page.tsx |
| 20 | /categories | /categories | app/(app)/categories/page.tsx |
| 21 | /new-category | /categories/new | app/(app)/categories/new/page.tsx |
| 22 | /edit-category | /categories/[id]/edit | app/(app)/categories/[id]/edit/page.tsx |
| 23 | /sectors | /sectors | app/(app)/sectors/page.tsx |
| 24 | /new-sector | /sectors/new | app/(app)/sectors/new/page.tsx |
| 25 | /edit-sector | /sectors/[id]/edit | app/(app)/sectors/[id]/edit/page.tsx |
| 26 | /suppliers | /suppliers | app/(app)/suppliers/page.tsx |
| 27 | /new-supplier | /suppliers/new | app/(app)/suppliers/new/page.tsx |
| 28 | /edit-supplier | /suppliers/[id]/edit | app/(app)/suppliers/[id]/edit/page.tsx |
| 29 | /perfil | /perfil | app/(app)/perfil/page.tsx |
| 30 | /help | /help | app/(app)/help/page.tsx |
| 31 | /admin | /admin | app/(app)/admin/page.tsx |
| 32 | /admin-create-user | /admin/users/new | app/(app)/admin/users/new/page.tsx |
| 33 | /admin-edit-user | /admin/users/[id]/edit | app/(app)/admin/users/[id]/edit/page.tsx |

Rotas técnicas novas explicitamente solicitadas pela recuperação: `/forgot-password` e `/reset-password` em `(auth)`, mais `/auth/callback/route.ts` para troca de código/redirect seguro. Não contam entre as 33 originais. Sem destino de redirect aberto.

Aliases antigos de criação podem redirecionar para `/.../new`. Edição antiga sem id não permite inferir registro: redirecionar para listagem com aviso de seleção, nunca pegar “último registro”. `/admin-create-user` é alias administrativo; `/admin-edit-user` leva à lista ADMIN. `/product-codes` permanece explícita, com stub se o modelo individual não for aprovado. `app/(app)/layout.tsx` fornece navbar/sidebar/breadcrumb; `not-found` e estados de loading/error são suporte técnico, não funcionalidades novas.

## 6. Fluxos e contratos transacionais

Os trechos a seguir são **especificações SQL/PLpgSQL em pseudocódigo documental**, não funções implementadas nem migrations executáveis. Respeitam o bloqueio de código da Fase 3. Assinaturas, colunas propostas e decisões pendentes serão concretizadas somente após aprovação. Uma RPC é uma única transação: exceção deve abortar todas as gravações, sem engolir erro e retornar sucesso [T2].

### 6.1 Empréstimo de produto

```text
Home: produto + destinatário + quantidade + dados de saída
  -> BFF/cliente autenticado chama lend_product
  -> banco verifica identidade, perfil atual, R + can_lend ou ADMIN
  -> SELECT produto FOR UPDATE
  -> validar quantidade inteira > 0 e <= qtd atual
  -> validar destinatário e contrato aprovado de códigos/sem devolução
  -> INSERT lendies (operador vem de auth.uid(), nunca do formulário)
  -> INSERT operations (snapshot mínimo, vínculo e operador)
  -> UPDATE products SET qtd = qtd - quantidade
  -> atualizar disponibilidade dos códigos, quando houver modelo aprovado
  -> sucesso único / qualquer erro = rollback integral
```

```sql
-- Contrato de public.lend_product(p_product_id uuid, p_quantity integer, ...)
-- LANGUAGE plpgsql; SET search_path = ''; autorização interna obrigatória.
BEGIN
  EXIGIR identidade e permissão de empréstimo atual;
  SELECT * FROM public.products WHERE id = p_product_id FOR UPDATE;
  EXIGIR produto existente, quantidade > 0, qtd >= quantidade;
  EXIGIR destinatário válido;
  SE has_barcode OU no_return com regra ainda desconhecida: REJEITAR com TODO explícito;
  INSERT INTO public.lendies (..., created_by) VALUES (..., auth.uid());
  INSERT INTO public.operations (..., user_id, lend_id) VALUES (..., auth.uid(), novo_id);
  UPDATE public.products SET qtd = qtd - p_quantity WHERE id = p_product_id;
  RETURN novo_id;
  -- Exceção propaga: nenhuma das três escritas permanece.
END;
```

O lock serializa empréstimos do mesmo produto. CHECK qtd >= 0 continua como defesa. Não aceitar “nova quantidade” calculada no navegador. Códigos e consumíveis não podem ser omitidos silenciosamente: enquanto TODO, caminho correspondente é bloqueado. Idempotência de submissão é proposta técnica: UUID de requisição único persistido no empréstimo, **a confirmar com o cliente**, para que retry após timeout não duplique retirada; desabilitar botão sozinho não basta.

### 6.2 Devolução de produto

```text
Selecionar empréstimo visível -> return_product
 -> verificar can_return / ADMIN e escopo da linha
 -> obter product_id; travar produto, depois empréstimo; reler e revalidar
 -> verificar estado aberto e quantidade ainda pendente
 -> atualizar quantidade devolvida/status/data/observação
 -> incrementar products.qtd somente pelo delta efetivamente devolvido
 -> registrar operation + liberar códigos aprovados
 -> commit único; erro/repetição inválida não altera estoque
```

Contrato proposto para devolução integral: delta = quantity - returned_quantity; delta positivo; após sucesso returned_quantity=quantity e status=DEVOLVIDO. Segunda devolução nunca incrementa novamente. **Não habilitar devolução parcial, finalização com faltantes nem devolução de SEM_DEVOLUCAO até validar regras.** Mostrar stub/TODO para essas opções. A data efetiva vai a returned_at; não sobrescrever uma data prevista sem resolver sua semântica. “ATRASADO” pode continuar devolvível se aprovado; calcular atraso depende do TODO de prazo/fuso.

### 6.3 Chaves

```text
lend_key -> autorizar -> lock keys FOR UPDATE
 -> exigir DISPONIVEL e ausência de empréstimo ativo
 -> inserir key_lends + operation -> keys.status=INDISPONIVEL -> commit
return_key -> autorizar/escopo -> lock keys e key_lends, nessa ordem
 -> exigir empréstimo ativo -> registrar devolução + operation
 -> keys.status=DISPONIVEL -> commit
Qualquer falha: rollback, inclusive histórico e status.
```

UNIQUE parcial de ativo complementa o lock. Datas/horas e observações são propostas de campos; registrar operations para chaves é melhoria proposta, não sequência confirmada do legado. Bloqueio manual do bem não pode ser ignorado na devolução: TODO de indisponibilidade manual deve ser resolvido antes de habilitar esse modo.

### 6.4 Carros

```text
lend_car -> autorizar -> lock car_keys
 -> disponível, sem ativo; validar km_out >= 0 e coerente com mileage
 -> car_key_lends + operation + status indisponível -> commit
return_car -> autorizar/escopo -> lock car_keys e car_key_lends
 -> exigir ativo, km_in >= km_out
 -> distance = km_in - km_out; atualizar km_in/returned_at/status
 -> car_keys.mileage = km_in; status disponível; inserir operation -> commit
```

**Proposta a validar:** odômetro de retirada não pode ser menor que cadastro; entrega não pode ser menor que retirada. Ausência de km_in implica distância NULL, não negativa. Não criar regra de correção/zeragem sem cliente. Devolução duplicada, retirada concorrente ou falha no histórico não alteram status/odômetro parcialmente.

Ordem de locks uniforme: recurso (produto/chave/carro), empréstimo, histórico; quando múltiplos recursos forem aprovados, ordenar por UUID. Testar concorrência com conexões independentes, não apenas chamadas sequenciais.

### 6.5 Gestão de contas

```text
Criar usuário:
ADMIN autenticado -> BFF valida sessão -> gate ADMIN no banco
 -> Auth Admin cria usuário com credencial somente no servidor
 -> trigger mínima cria perfil USER seguro, não confia em metadata de role
 -> rotina administrativa atribui role/permissões aprovadas
 -> sucesso; falha intermediária exige compensação/reconciliação explícita
USER -> gate SQL nega; escrita direta de perfil nega; Auth Admin não é exposto

Editar role/permissões:
ADMIN -> rotina SQL autorizada -> valida JSON e invariantes -> atualiza perfil
USER -> sem grant direto + gate da rotina nega, inclusive em si próprio

Nome/foto próprios:
sessão -> update_my_profile -> banco exige id=auth.uid() e allowlist de campos

Email/senha:
sessão -> Supabase Auth (reautenticação/confirmação conforme configuração)
 -> após confirmação de email, sincronização confiável de usuarios.email
 -> senha nunca é copiada para usuarios nem operations

Excluir conta:
sessão recente -> confirmar alvo/autoridade -> verificar referências/retenção
 -> BFF/Auth Admin somente se autorizado; FK protege histórico
 -> exclusão de auth.users remove perfil por cascade quando permitido
 -> limpeza Storage com compensação (não é transação SQL do empréstimo)
```

**Limite de atomicidade:** chamadas HTTP à API de Auth e ao Storage não se tornam uma única transação PostgreSQL. Não prometer rollback global. Perfil criado por trigger do Auth deve ser testado em ambiente isolado; permissões administrativas posteriores podem falhar, deixando no máximo um perfil USER restrito e um estado a reconciliar, nunca um ADMIN por metadata [T4].

Signup público deve ficar desabilitado para impedir que acesso direto ao Auth contorne o cadastro ADMIN (proposta). Bootstrap do primeiro ADMIN é procedimento fora do frontend, autorizado por TI, sem endpoint público de promoção. **Proposta a validar:** impedir remoção/rebaixamento do último ADMIN com serialização no banco; proibir autoelevação de USER. Autoexclusão aparece no mapa, mas a retenção de histórico não: bloquear fisicamente contas referenciadas até decisão de anonimização/desativação; não apagar histórico como compensação.

## 7. Estratégia de testes e aceite

Ferramentas propostas, dependentes de aprovação/instalação no Marco 1: Vitest para unidade, Playwright para E2E, SQL transacional/pgTAP se disponível para banco. Não há suíte executável criada nesta fase.

| Camada | Casos mínimos | Evidência de aceite |
|---|---|---|
| Unidade | Quantidade zero/negativa/fracionária; quantidade igual/maior que estoque; delta de retorno; retorno duplicado; km_in<km_out/igual/maior/NULL; JSON ausente/inválido; regras de formulário Zod | Testes determinísticos sem dados reais. |
| Integração SQL | As 104 células, anon, sem perfil, ADMIN, USER padrão/restrito; INSERT/UPDATE com campo protegido; troca de role/permissão; RLS sem recursão; EXECUTE indevido; relatórios gerais negados a USER com todas as flags | Acesso direto à API/SQL com identidades reais de teste, não apenas botões escondidos. |
| Atomicidade | Forçar erro no INSERT de operations após iniciar empréstimo/devolução; conferir empréstimo, estoque/status/odômetro/códigos inalterados | Snapshot antes/depois; transação abortada. |
| Concorrência | Dois empréstimos disputam última unidade/chave/carro; duas devoluções simultâneas; remoção do último ADMIN em duas sessões | Nunca estoque negativo, duplicidade ativa, incremento duplo ou zero ADMIN. |
| Auth/Storage | Recuperação completa; callback inválido/expirado; sessão revogada; acesso a foto alheia; arquivo inválido; falha de compensação | Sem segredo no bundle/log; sem objeto público involuntário. |
| E2E operacional | Login → cadastrar recurso permitido → emprestar → devolver → consultar histórico | ADMIN e USER com flags distintas; estados/erros acessíveis. |
| E2E relatório | Login → empréstimo → devolução → relatório operacional autorizado; ADMIN relatório geral | Marco 6 pós-núcleo; USER recebe negação ao exportar relatório geral diretamente. |

Não usar service role para demonstrar RLS: ela não representa o cliente comum. Testes destrutivos e falhas injetadas somente em banco isolado. Stubs não contam como funcionalidade concluída; impedimento e responsável pelo desbloqueio ficam registrados.

## 8. Pendências para aprovação

| ID | Decisão necessária | Tratamento até confirmação | Marco bloqueado |
|---|---|---|---|
| D01 | Matriz/flags/defaults e alcance de relatórios USER | Proposta desta seção 4; negar ausências | 1–6, conforme entidade |
| D02 | Códigos por exemplar, formato/simbologia e armazenamento com 13 tabelas ou extensão | Stub explícita; não emprestar com código individual | 3 e parte de 5 |
| D03 | Devolução integral/parcial, faltantes e sem devolução | Propor integral única; bloquear demais regras | 5 |
| D04 | Papel de acadêmicos e obrigatoriedade do destinatário | Não adicionar vínculo nem exigir silenciosamente | 5 |
| D05 | Data prevista/efetiva, atraso, fuso operacional | Não automatizar ATRASADO sem contrato | 5 |
| D06 | Carro/chave, unidade do odômetro e correções | Manter nomenclatura B; fórmula proposta identificada | 4–5 |
| D07 | Entrada/ajuste de estoque e quais operações registrar | Comando atômico proposto; sem UPDATE livre de qtd | 3 |
| D08 | Exclusão de conta com histórico, retenção, último ADMIN e autoexclusão | Negar exclusão incompatível; não apagar histórico | 1 e 6 |
| D09 | Colunas novas e saneamento do schema remoto | Nenhuma migração aplicada; marcar a confirmar | 1–5 |
| D10 | Templates/campos/filtros de PDF/Excel e separação operacional/geral | Sem inventar relatório novo | 6 pós-núcleo |
| D11 | Imagens de produto, limites MIME/tamanho, anexos e retenção | Buckets privados propostos; anexos TODO | 1 e 3 |
| D12 | Indisponibilidade manual versus emprestado | Não permitir liberar bem emprestado por CRUD | 4–5 |
| D13 | Idempotência de comandos e persistência de UUID de requisição | Proposta; testar retry antes do aceite | 5 |

As pendências podem ser respondidas por marco; não requerem inventar uma regra para concluir estes documentos. O aceite da documentação não deve ser interpretado como aprovação automática de cada TODO. A Fase 3 só começa após “ok” explícito, com decisões bloqueantes registradas.

## 9. Referências técnicas oficiais

Fontes externas servem apenas à segurança/arquitetura, nunca para acrescentar funcionalidades ausentes no mapa. URLs como referências documentais solicitadas; verificar compatibilidade com versões escolhidas na implementação.

- **[T1]** Supabase — Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- **[T2]** Supabase — Database Functions: https://supabase.com/docs/guides/database/functions
- **[T3]** Supabase — Creating a client for SSR: https://supabase.com/docs/guides/auth/server-side/creating-a-client
- **[T4]** Supabase — Managing User Data: https://supabase.com/docs/guides/auth/managing-user-data
- **[T5]** Supabase — Storage Access Control: https://supabase.com/docs/guides/storage/security/access-control