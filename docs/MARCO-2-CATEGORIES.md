# Marco 2 — template categories para validação

Marco 1 aprovado/homologado pelo cliente; GitHub e Vercel configurados conforme relato do cliente. Esta pasta de trabalho ainda não contém metadados Git; nenhuma publicação foi feita pelo agente.

## Escopo entregue

- `/categories`: busca por nome, paginação server-side de 10 itens, ordem estável por nome/id, estados vazio/erro/carregamento e ações conforme permissões.
- `/categories/new` e `/categories/[id]/edit`: react-hook-form + zodResolver, schema Zod compartilhado com o servidor, mensagens acessíveis e prevenção de envio duplicado.
- Exclusão com dialog nativo modal, foco inicial em Cancelar, bloqueio durante envio, tratamento de FK e erros sem SQL interno.
- Server Actions revalidam identidade e perfil atual; o serviço de comandos verifica permissões, UUID e campos aceitos antes de persistir. Nenhum papel/permissão fornecido pelo formulário é aceito.
- Supabase usa exclusivamente sessão do usuário. RLS continua responsável pela autorização final, inclusive se permissões mudarem entre leitura do perfil e mutação.
- ADMIN ativo lê/cria/edita/exclui; USER precisa de `can_read_inventory` para leitura, também `can_manage_catalogs` para criar/editar e adicionalmente `can_delete` para excluir. Flags ausentes/inválidas, versão desconhecida e perfil inativo negam.

## Arquivos de referência para revisão

- `C:\Projetos\Uniguacu\app\(app)\categories\page.tsx`
- `C:\Projetos\Uniguacu\app\(app)\categories\new\page.tsx`
- `C:\Projetos\Uniguacu\app\(app)\categories\[id]\edit\page.tsx`
- `C:\Projetos\Uniguacu\app\(app)\categories\actions.ts`
- `C:\Projetos\Uniguacu\components\categories\category-form.tsx`
- `C:\Projetos\Uniguacu\components\categories\delete-category.tsx`
- `C:\Projetos\Uniguacu\components\ui\table.tsx`
- `C:\Projetos\Uniguacu\lib\categories\` (schema, paginação, comandos e repositório)
- `C:\Projetos\Uniguacu\lib\auth\permissions.ts`
- `C:\Projetos\Uniguacu\supabase\migrations\0004_categories_crud.sql`
- `C:\Projetos\Uniguacu\tests\categories.test.ts`
- `C:\Projetos\Uniguacu\supabase\tests\marco2_categories.sql`

Também alterados: sessão para selecionar limited_access, navegação/breadcrumb, package.json e package-lock.json. Dependências solicitadas instaladas com versões fixas: react-hook-form 7.92.0 e @hookform/resolvers 7.0.5. Não há dependência de TanStack: a tabela usa componentes locais no padrão shadcn/ui e paginação no servidor.

## Banco: etapa necessária antes da homologação

A migration 0004 **não foi aplicada**. Revisar catálogo e executar em Supabase isolado após 0001–0003 já instaladas, sem reaplicar a baseline. 0004 não altera outras entidades; concede somente INSERT(name), UPDATE(name), SELECT e DELETE, com RLS. Preserva UNIQUE(name), UUIDs e FK sem cascade. CHECK de nome não vazio usa NOT VALID para não alterar/sanear dados legados silenciosamente; escritas novas são verificadas. Políticas adicionais desconhecidas fazem a migration abortar.

Sem a migration 0004, o Marco 1 continua bloqueando as mutações de categories. Não tentar corrigir essa negação com service role ou desativando RLS.

## Testes executados

`npm run lint`, `npm test`, `npm run build` e `npm run typecheck`: aprovados. Total: 15 testes (11 novos de categories/permissões e 4 existentes).

Casos novos: nome vazio/trim/campos extras/UUID; matriz ADMIN/USER/flags inválidas/inativo; exclusão negada antes de persistir; criação/edição autorizadas; revogação de flag; conflitos unique/FK/RLS simulados; falha de rede; zero linhas afetadas; paginação/busca e parâmetros repetidos.

Navegador Playwright em build de produção: as três rotas de categories redirecionam para login sem sessão. Nenhuma credencial de usuário ou chave privilegiada usada e nenhum dado remoto criado.

Não executados: SQL/RLS real e CRUD autenticado completo, pois não há PostgreSQL/Docker/Supabase CLI local nem identidade de teste configurada para essa execução. Os testes unitários de comandos usam repositório simulado; não equivalem a teste de banco ou chamada HTTP de Server Action. Teste SQL transacional entregue, com fixtures fictícias e rollback, para ambiente isolado.

## Roteiro de validação pelo cliente

1. Aplicar 0004 no ambiente isolado revisado e iniciar `npm run dev`.
2. ADMIN: criar, buscar, editar, recarregar e excluir categoria sem vínculo.
3. Criar nome vazio/duplicado e tentar excluir categoria vinculada: devem retornar mensagens legíveis.
4. Criar mais de 10 categorias de teste: validar próxima/anterior, busca e exclusão do último item da última página.
5. USER com flags básicas: criar/editar, sem botão de excluir; chamada direta também negada.
6. USER com can_delete=true: exclusão permitida apenas com read/manage; retirar can_manage_catalogs e validar bloqueio no próximo comando.
7. Verificar teclado, confirmação de exclusão e tela móvel autenticada.

Aguardar aprovação deste template antes de replicar para sectors, suppliers, collaborators e academics.