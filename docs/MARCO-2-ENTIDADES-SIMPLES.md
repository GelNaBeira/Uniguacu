# Marco 2 — quatro entidades restantes

## Escopo

Template categories homologado pelo cliente, inclusive migration 0004. Implementados setores, fornecedores, colaboradores e acadêmicos com rotas de listagem, criação e edição, Server Actions próprias e componentes compartilhados seguindo o fluxo do template. Categories permanece sem refatoração.

Campos: sectors(name); suppliers(fantasy_name, legal_name, cnpj_cpf); collaborators(name, identification, role_function, phone); academics(name, ra, course). Somente nome/nome fantasia obrigatório. Campos opcionais vazios persistidos como NULL e convertidos para string vazia ao editar. Sem unicidade nova em identificação, documento ou RA; sem novos vínculos de acadêmicos. CPF/CNPJ: apenas formato, com ou sem máscara; suporta CNPJ numérico e alfanumérico; sem cálculo de dígitos ou consultas externas. Busca por nome (nome fantasia em fornecedores), 10 itens por página, ordenação estável por nome/id.

## Arquivos

- `C:\Projetos\Uniguacu\app\(app)\sectors\`, `suppliers\`, `collaborators\` e `academics\`: cada módulo contém actions.ts, page.tsx, new/page.tsx, [id]/edit/page.tsx, loading.tsx e error.tsx.
- `C:\Projetos\Uniguacu\lib\catalogs\`: schemas/configuração de campos, comandos testáveis, repositório Supabase, orquestração server-only e paginação reutilizada do template.
- `C:\Projetos\Uniguacu\components\catalogs\`: formulário RHF/Zod, páginas server-side, exclusão modal e estado de erro.
- `C:\Projetos\Uniguacu\components\app-navigation.tsx`: quatro links e breadcrumbs específicos.
- `C:\Projetos\Uniguacu\supabase\migrations\0005_simple_entities_crud.sql`.
- `C:\Projetos\Uniguacu\tests\catalogs.test.ts` e `C:\Projetos\Uniguacu\supabase\tests\marco2_simple_entities.sql`.

Sem dependências novas. Sem alteração do .env.local ou uso de credencial privilegiada.

## Segurança e migration

Todas as ações obtêm identidade/perfil atual e verificam can_manage_catalogs/can_delete com o helper de permissões homologado. RLS aplica autorização final com sessão do usuário, sem service role. Tipos de entidade e campos são allowlists estáticas; IDs e payloads são validados novamente no servidor.

0005 é transacional e cobre as quatro tabelas: RLS, grants por coluna, SELECT/INSERT/UPDATE/DELETE com os mesmos predicados de categories, checks de nome não vazio e formato de documento. Revoga grants legados de tabela e coluna antes de conceder somente os campos permitidos; UUID e created_at continuam protegidos. Mantém FKs e unicidade original de setor. Checks NOT VALID não saneiam registros históricos, mas valem para escritas novas; registros legados inválidos podem precisar de correção manual ao editar. Políticas desconhecidas fazem a migration abortar, sem serem apagadas silenciosamente.

**Migration não aplicada pelo agente.** Aplicar 0005 uma vez no ambiente de homologação após revisar catálogo e confirmar 0001–0004 instaladas. Sem 0005, mutações continuam bloqueadas pelas permissões do Marco 1.

## Relatório de validação

- `npm run lint`: aprovado.
- `npm test`: 41 aprovados, zero falhas (26 novos + 15 existentes).
- `npm run build`: aprovado; 12 novas rotas compiladas.
- `npm run typecheck`: aprovado.
- Playwright, contexto isolado sem cookies: todas as 12 rotas novas redirecionam ao login.
- Navegador com sessão já existente: quatro formulários de criação renderizados com 1/3/4/3 campos; envio vazio rejeitado pelo Zod no cliente em todos. Nenhuma mutação válida foi enviada. Viewport móvel de 390px na criação de acadêmico sem overflow horizontal.
- SQL transacional entregue, não executado: sem PostgreSQL/Docker/Supabase CLI local. Nenhum banco remoto foi modificado. Testes unitários de persistência usam mocks e não comprovam RLS real.

## Homologação restante

Aplicar 0005 e executar CRUD completo com ADMIN/USER: incluir/editar/excluir, busca, mais de 10 registros, setor duplicado, documentos inválidos, FK em setor/fornecedor/colaborador, campos opcionais NULL, revogação de flags e acesso direto à API. Teste SQL somente em banco isolado, com fixtures fictícias e rollback. Layout de listagens autenticadas e CRUD persistido ainda dependem dessa homologação. Não avançar para Marco 3 sem aceite.