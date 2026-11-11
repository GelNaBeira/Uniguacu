# Marco 3 — Produtos

## Entrega

- Marco 2 homologado pelo cliente. CRUD de produtos disponível em `/products`, `/products/new` e `/products/[id]/edit`.
- Listagem com busca literal por nome, filtros combinados de categoria/setor, dez linhas por página e ordenação estável nome/UUID.
- Formulário React Hook Form + Zod; selects nativos acessíveis alimentados no servidor por categorias, setores e fornecedores. Consulta paginada das opções, sem truncamento silencioso no limite padrão da API.
- Nome obrigatório; preço opcional não negativo com duas casas decimais; nota, descrição, relacionamentos e código manual opcionais. Campos textuais opcionais vazios persistem como NULL.
- `has_barcode` booleano e `bar_code` texto manual, sem UNIQUE novo, bibliotecas de leitura/geração ou códigos por exemplar (D02).
- Quantidade inicial inteira não negativa no INSERT. Edição exibe campo desabilitado e o aviso aprovado: “A quantidade em estoque só pode ser alterada através de movimentações”. Schema strict de edição rejeita `qtd`, inclusive chamadas diretas da action.
- Quantidade inicial no INSERT segue a autorização mais recente do cliente, substituindo neste marco a proposta anterior da seção 4.5 do PDD. Não há RPC nem histórico de movimentação inicial nesta entrega; movimentações continuam no Marco 5.
- ADMIN ativo: CRUD completo. USER ativo: leitura exige `can_read_inventory`; escrita também exige `can_manage_products`; exclusão também exige `can_delete`. Actions recarregam perfil e usam sessão do usuário, sem service role.
- Navegação, breadcrumbs, loading, error, mensagens de sucesso, acesso negado, not-found e confirmação de exclusão.

## Imagens

- Contrato aprovado pelo cliente: JPEG, PNG e WebP, até 3 MiB (3 × 1024 × 1024 bytes).
- Bucket privado `product-images`. Caminho relativo `<product-id>/<uuid>.<jpg|png|webp>`; o nome original do arquivo não é utilizado.
- Servidor valida tamanho, MIME declarado e assinatura binária. Isso não equivale a decodificação integral, antivírus ou detecção de arquivos políglotas. SVG e MIME não permitidos são rejeitados.
- Produto é persistido primeiro, pois upload exige produto existente. Foto é enviada com UUID novo, sem upsert; depois `image_path` é vinculado. Atualização condicional evita sobrescrever silenciosamente uma foto alterada em outra sessão.
- Não existe atomicidade entre banco e Storage: falha na foto não desfaz um produto salvo. A interface informa o resultado parcial e oferece abrir a edição sem incentivar duplicar o cadastro.
- Substituição limpa foto anterior se houver permissão de exclusão. USER sem `can_delete` pode substituir a referência, mas recebe aviso sobre limpeza administrativa da foto antiga. Upload sem vinculação tenta compensação quando autorizada; falhas são informadas.
- Exclusão primeiro remove a linha (preservando FK), depois limpa arquivos do diretório pela API Storage. Falha de limpeza é informada sem alegar que o produto permanece cadastrado.
- Objetos referenciados não podem ser apagados pela policy; substituições são imutáveis, sem policy UPDATE/move. SELECT permite listar órfãos para limpeza após exclusão do produto.
- Listagem e edição emitem URLs assinadas de 300 segundos, após autorização/RLS; sem tornar bucket público. Recarregar a página renova as URLs. URLs já emitidas podem permanecer válidas até expirar, inclusive após revogação de permissão.
- Limite de corpo das Server Actions: 4 MB para comportar foto aprovada de 3 MiB e overhead do formulário. Nenhuma dependência adicionada.

## Migration a aplicar

Arquivo: `C:\Projetos\Uniguacu\supabase\migrations\0006_products_crud.sql`.

1. Confirmar `0001–0005` já instaladas. **Não reaplicar baseline nem migrations anteriores.**
2. Revisar/aplicar somente `0006`, preferencialmente primeiro em ambiente isolado.
3. Migration transacional: adiciona `image_path`, índices, checks NOT VALID, RLS de produtos, grants por coluna, bucket privado e policies Storage.
4. INSERT permite `qtd`; UPDATE não permite `qtd`, `id` ou `created_at`, inclusive para ADMIN autenticado via API. INSERT não permite `image_path`; a referência é vinculada após upload. A leitura do registro usa SELECT autorizado.
5. Trigger invoker valida existência/acesso do objeto vinculado. Constraint exige diretório do mesmo UUID do produto; policy INSERT Storage exige produto existente.
6. Checks NOT VALID não corrigem dados legados automaticamente: linhas antigas inválidas podem bloquear sua próxima atualização até correção explícita. IDs, datas, estoque existente e FKs são preservados.
7. A migration aborta diante de policies desconhecidas em products ou de **qualquer policy preexistente em storage.objects**, pois policies permissivas podem abrir acesso por OR. Não apagar policies para forçar a aplicação: inventariar e reconciliar seu escopo, inclusive buckets de avatar, antes de adaptar o preflight.
8. Bucket preexistente só é aceito se já for privado e possuir exatamente o limite/MIMEs aprovados. Incompatibilidade aborta sem reconfiguração silenciosa.

## Arquivos criados

- `C:\Projetos\Uniguacu\app\(app)\products\actions.ts`
- `C:\Projetos\Uniguacu\app\(app)\products\page.tsx`
- `C:\Projetos\Uniguacu\app\(app)\products\new\page.tsx`
- `C:\Projetos\Uniguacu\app\(app)\products\[id]\edit\page.tsx`
- `C:\Projetos\Uniguacu\app\(app)\products\loading.tsx`
- `C:\Projetos\Uniguacu\app\(app)\products\error.tsx`
- `C:\Projetos\Uniguacu\components\products\product-pages.tsx`
- `C:\Projetos\Uniguacu\components\products\product-form.tsx`
- `C:\Projetos\Uniguacu\components\products\product-delete.tsx`
- `C:\Projetos\Uniguacu\components\products\relation-select.tsx`
- `C:\Projetos\Uniguacu\components\ui\select.tsx`
- `C:\Projetos\Uniguacu\lib\products\schema.ts`
- `C:\Projetos\Uniguacu\lib\products\service.ts`
- `C:\Projetos\Uniguacu\lib\products\repository.ts`
- `C:\Projetos\Uniguacu\lib\products\pagination.ts`
- `C:\Projetos\Uniguacu\lib\products\options.ts`
- `C:\Projetos\Uniguacu\lib\products\image-validation.ts`
- `C:\Projetos\Uniguacu\lib\products\images.ts`
- `C:\Projetos\Uniguacu\supabase\migrations\0006_products_crud.sql`
- `C:\Projetos\Uniguacu\supabase\tests\marco3_products.sql`
- `C:\Projetos\Uniguacu\tests\products.test.ts`
- `C:\Projetos\Uniguacu\docs\MARCO-3-PRODUTOS.md`

Arquivos alterados:

- `C:\Projetos\Uniguacu\lib\auth\permissions.ts`
- `C:\Projetos\Uniguacu\components\app-navigation.tsx`
- `C:\Projetos\Uniguacu\next.config.ts`

## Validação realizada

- `npm test`: **65 testes aprovados, zero falhas** (24 novos de produtos).
- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `npm run build`: aprovado, com as três rotas de produtos dinâmicas.
- `git diff --check`: aprovado.
- Browser contra build de produção: três rotas redirecionam para `/login` em contexto realmente vazio, criado com cookies/origins vazios. O contexto nomeado inicial acabou reutilizando sessão; não foi considerado prova de proteção e nenhuma mutação válida foi enviada.
- Não houve aplicação da migration, alterações remotas, upload real, push ou deploy pelo agente.
- SQL/RLS/Storage API e CRUD persistido **não executados**: PostgreSQL, Docker e Supabase CLI ausentes localmente; `0006` ainda depende de aplicação pelo cliente. Mocks de repository não comprovam segurança do banco.
- `marco3_products.sql` foi criado para Supabase **isolado**, com fixtures fictícias e rollback. Testa grants, RLS, quantidade inicial, proibição UPDATE qtd, FK, permissões atuais e metadados Storage. Não testa tráfego real de upload, assinatura/expiração ou limites do gateway. Não executar esse script em produção.

## Roteiro de homologação após 0006

1. ADMIN: criar com quantidade inicial e relações; confirmar dados persistidos, foto privada e preview/listagem. Sem foto e opcionais vazios devem funcionar.
2. Editar nome/preço/categoria/setor/fornecedor; estoque deve permanecer igual. Tentar UPDATE direto em `qtd` via cliente autenticado: deve ser negado no banco, inclusive ADMIN.
3. Validar nome vazio, quantidade negativa/fracionária, preço inválido, relações removidas e IDs inválidos.
4. Fotos: testar JPEG/PNG/WebP reais, limite de 3 MiB, arquivo maior, SVG e conteúdo incompatível com MIME; substituir foto e simular falha de upload/rede.
5. Verificar busca por nome, filtros combinados e paginação com mais de dez produtos; busca/filtros precisam permanecer ao navegar.
6. USER: leitura apenas; leitura+manage_products; depois can_delete. Revogar manage_products durante a sessão e repetir operação. Perfil inativo deve perder acesso.
7. Exclusão de produto com empréstimo deve falhar por FK; exclusão sem vínculo deve limpar fotos ou informar pendência. USER sem can_delete não deve excluir produto nem arquivo.
8. Testar URL pública direta do bucket (negada), URL assinada (temporária), caminho de produto inexistente e tentativa de mover/sobrescrever arquivo (negadas).
9. Conferir desktop/mobile, navegação por teclado e mensagens de erro após integração.
10. Reconciliar eventuais policies remotas apontadas pelo preflight, executar teste SQL em ambiente isolado e homologar antes de iniciar o próximo marco.