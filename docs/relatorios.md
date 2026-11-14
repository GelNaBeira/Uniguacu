# Relatórios PDF e Excel

- `/home`: aplique status, tipo, datas de saída inclusivas (UTC), vínculo e parte do nome; clique em **Filtrar** antes de **Gerar Relatório**. A exportação inclui todas as páginas filtradas. Trocar abas ou páginas preserva os filtros.
- USER precisa estar ativo e ter `can_read_inventory` e `can_view_reports`. RLS preserva a visibilidade própria/ampliada de `can_view_all_lends`. A permissão de relatório não amplia acesso aos empréstimos.
- `/admin`: **Gerar Relatório Geral**, exclusivamente ADMIN ativo, inclui todas as fontes de empréstimos, inclusive consumos, status legado/nulo e devoluções; outra seção contém `PRODUCT_STOCK_ENTRY` de `operations`, com data, quantidade, estoque anterior, observação e responsável.
- O saldo inicial de produtos não é uma entrada auditada: não é inventado no relatório. Datas legadas sem horário são identificadas. Identificadores permanecem disponíveis para rastreabilidade.
- Server Action valida sessão, papel, permissão e entrada antes de consultar/renderizar. Usa apenas cliente da sessão com RLS, sem service role ou alteração do banco. PDF e Excel são gerados no servidor e retornados em base64 para Blob/download local; não há arquivo público persistido.
- Limites de proteção: 10.000 registros por seção e 24 MiB em base64. Acima disso, falha explícita, sem arquivo parcial. Para volumes maiores, implementar exportação assíncrona/streaming. O geral não oferece filtros e, acima do limite, requer essa evolução.
- Consultas em lotes de 100, ordenação estável. Não constituem snapshot transacional: evitar exportação durante movimentações intensas quando uma conciliação pontual for necessária.
- Excel mantém conteúdo como texto ou número, nunca fórmula fornecida por usuários. Bibliotecas de geração ficam fora do bundle do navegador.
- Dependências: jsPDF, jsPDF-AutoTable e ExcelJS; override localizado do UUID transitivo do ExcelJS para 11.1.1 (CommonJS), validado por geração e reabertura do XLSX.

Validação: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`. Testes cobrem matriz RBAC, chamada direta bloqueada, validação, filtros persistidos, falhas, PDF multipágina e XLSX reaberto sem fórmulas. Homologação autenticada com dados reais deve conferir RLS e download nos navegadores utilizados.