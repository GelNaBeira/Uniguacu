# Recuperação de desenvolvimento e envio de formulários

## Reset de products — execução exclusivamente manual

1. Confirmar projeto Supabase de **desenvolvimento**, sem produtos a preservar. Revisar dependências customizadas: DROP CASCADE pode remover views/policies externas que não constam no projeto.
2. Executar inteiro `C:\Projetos\Uniguacu\supabase\migrations\0006a_reset_products.sql` como postgres.
3. Depois executar inteiro `C:\Projetos\Uniguacu\supabase\migrations\0006_products_crud.sql` **atualizado**.
4. Não reaplicar baseline. Não incluir o reset em execução automática de migrations, deploy ou produção. A ordem acima é manual, não a ordem alfabética dos arquivos.

O reset apaga todos os produtos e recria as 14 colunas, constraints, índices e FKs de categoria/setor/fornecedor; restaura também `lendies.product_id`, removida pelo CASCADE. Aborta se lendies tiver registros ou se houver outras FKs para products. Não apaga empréstimos silenciosamente.

Remove somente as três policies Storage conhecidas do Marco 3 antes do reset. Mantém RLS habilitada e revoga acesso da tabela recriada, que fica inacessível pelo cliente até aplicar 0006. Não desativa RLS nem usa service role.

A 0006 foi adaptada para tolerar coluna/constraints/índices recriados pelo reset e substituir funções privadas eventualmente remanescentes. Essa compatibilidade não equivale a idempotência geral: policies desconhecidas continuam causando aborto. Se houver policies de outros buckets, revisar/reconciliar em vez de apagá-las.

O reset não remove objetos reais do Storage. Fotos anteriores podem ficar órfãs e devem ser limpas pela API/painel Storage, nunca apagando apenas seus metadados SQL. Bucket existente ainda precisa ser privado, com 3 MiB e JPEG/PNG/WebP, conforme preflight da 0006.

O arquivo 0006 já era transacional: falha de uma execução integral normalmente reverte suas alterações. `image_path already exists` indica estado preexistente ou execução parcial/selecionada, não comprova que a transação original tenha sido parcialmente confirmada. Sem catálogo remoto, a origem exata permanece não confirmada.

## Categorias e formulário genérico

URL `/categories/new?name=teste` indica submissão nativa GET. O formulário anterior não tinha método explícito, embora `handleSubmit` do RHF já devesse cancelar o evento quando hidratado. Portanto, não era correto atribuir o sintoma apenas à falta de startTransition: ausência/falha de hidratação, assets antigos/bloqueados ou JS desabilitado continuam hipóteses.

Correções:

- `preventDefault` síncrono antes de qualquer validação/await.
- Validação e chamada assíncrona dentro de `startTransition`, com indicador pending combinado ao RHF.
- `method="post"` explícito, evitando fallback GET com campos na URL.
- Fieldset e submit desabilitados durante SSR/pré-hidratação e durante envio. Se o JavaScript não iniciar, a tela informa que está aguardando o formulário; não finge salvar.
- Falhas de validação/transporte/banco continuam em texto vermelho `role="alert"`, sem limpar campos nem redirecionar. Duplicidade 23505 mantém mensagem “Já existe uma categoria com este nome.”.
- Origem de desenvolvimento `192.168.0.20` explicitamente permitida em `next.config.ts` para assets do dev server. Isso não relaxa RLS nem adiciona wildcard/allowedOrigins de Server Actions.

Reiniciar `npm run dev` após atualizar next.config e recarregar o navegador sem cache. Se a mensagem de inicialização persistir, inspecionar Console/Network e requests `/_next/`: a causa da falha de hidratação ainda precisa de evidência no navegador afetado.

## Arquivos

- `C:\Projetos\Uniguacu\supabase\migrations\0006a_reset_products.sql` (novo, destrutivo/manual)
- `C:\Projetos\Uniguacu\supabase\migrations\0006_products_crud.sql`
- `C:\Projetos\Uniguacu\components\categories\category-form.tsx`
- `C:\Projetos\Uniguacu\components\catalogs\catalog-form.tsx`
- `C:\Projetos\Uniguacu\components\use-client-ready.ts` (novo)
- `C:\Projetos\Uniguacu\lib\forms\submission.ts` (novo)
- `C:\Projetos\Uniguacu\next.config.ts`
- `C:\Projetos\Uniguacu\tests\form-submission.test.ts` (novo)
- `C:\Projetos\Uniguacu\docs\CORRECOES-RESET-E-FORMULARIOS.md` (novo)

## Verificações

- 72 testes unitários aprovados; novos testes verificam cancelamento antes da transição e preservação de estado em duplicidade simulada.
- Lint, typecheck e build de produção aprovados; diff sem erros de whitespace.
- Nenhum reset, migration ou mutação remota executado. SQL não executado: sem PostgreSQL/Docker/Supabase CLI local. CRUD duplicado real via navegador/IP e sequência SQL precisam de homologação no ambiente DEV.