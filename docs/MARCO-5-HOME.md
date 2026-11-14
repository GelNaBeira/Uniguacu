# Marco 5 — etapa 2 / Home

## Entrega em 13/11/2026

- Home substitui o placeholder por tabela unificada de produtos, chaves e carros.
  Padrão: ativos (EM_ANDAMENTO e ATRASADO); filtros individuais e DEVOLVIDO,
  tipo de item, contagem exata e paginação de dez linhas com filtros na URL.
- Cada linha apresenta item/tipo, quantidade ou KM de saída, colaborador, data e
  status. Datas efetivas identificadas em UTC até confirmação do fuso operacional.
  Legado mostra out_date sem inventar horário. Atraso automático continua fora do escopo.
- Novo empréstimo em dialog nativo acessível: busca por nome e opções paginadas
  de dez em dez para recursos e colaboradores. Produto com estoque positivo;
  chave/carro disponível. Colaborador obrigatório, quantidade inteira limitada ao
  estoque consultado e KM de saída obrigatório, não inferior ao cadastro.
- Devolver abre confirmação integral. Carro exige KM de retorno >= KM de saída;
  o banco também verifica o odômetro atual. Registro legado sem contrato da 0009
  não oferece botão de devolução: requer reconciliação, sem escrita direta.
- UUID criado com crypto.randomUUID no cliente, preservado com payload congelado
  após resposta incerta; mutex síncrono impede duplo clique antes do rerender.
  Erro definitivo libera correção; resposta incerta anterior permanece incerta
  mesmo se um retry posterior for negado. Não recarregar/navegar durante incerteza:
  a intenção é mantida em memória, não persiste entre reloads. Verificar a listagem
  antes de registrar outra retirada quando a sessão não permitir confirmar o retry.
- Server Actions recarregam perfil e usam somente cliente Supabase com cookies do
  usuário. Gate de leitura + can_lend/can_return; ADMIN ativo ignora flags. Escopo
  por autor/can_view_all_lends na interface, RLS na consulta e autorização interna
  nas RPCs. Nenhum service role, INSERT/UPDATE direto ou alteração no banco.
- SQLSTATE traduzido em mensagem segura. Resultado RPC precisa conter UUID válido;
  erro, resposta vazia, timeout ou exceção nunca são tratados como sucesso.

## Arquivos

Todos relativos à raiz absoluta `C:\Projetos\Uniguacu\`:

- `app\(app)\home\page.tsx` e `actions.ts`.
- `components\lending\new-loan.tsx`, `return-loan.tsx`, `option-picker.tsx`.
- `lib\lending\schema.ts`, `service.ts`, `pagination.ts`, `queries.ts`.
- `lib\auth\permissions.ts` e `tests\lending.test.ts`.

## Validação e limites

- Testes Node cobrem contratos das seis RPCs, schemas strict, UUID, destinatário,
  estoque máximo/odômetro consultados, permissão revogada/inativo, escopo e legado,
  falhas/rede sem exposição interna, merge global, filtros e integração textual.
- Validação final: `npm test` com **127 aprovados, zero falhas** (16 novos testes);
  `npm run lint`, `npm run typecheck`, `npm run build` e `git diff --check` aprovados,
  todos com código 0. Nenhuma dependência instalada ou migration aplicada nesta etapa.
- Smoke HTTP local de produção: `/home` sem sessão retorna 307 para `/login`;
  `/login` retorna 200. Servidor temporário encerrado após a verificação.
- Playwright não conseguiu acessar o servidor local entre chamadas (processo filho
  encerrado pelo ambiente). Nenhuma sessão autenticada estava disponível; não foi
  contornado login nem criado usuário/credencial para simular homologação visual.
  Fluxos completos de navegador autenticado aguardam validação do cliente.
- Merge sem migration: cada fonte consulta o prefixo necessário da página global,
  ordenado por out_date e UUID descendentes, em lotes de até 100 para não truncar
  no limite da API. Páginas profundas custam mais leituras; para grande escala,
  considerar consulta UNION paginada SECURITY INVOKER em uma entrega separada.
  Contagem e linhas não constituem snapshot único durante movimentação concorrente.
- Os gates anteriores de concorrência real, falha injetada no histórico e validação
  HTTP/JWT das RPCs não são substituídos por testes unitários ou build.

## Roteiro de aceite no navegador

1. Entrar como ADMIN e acessar `/home`. Confirmar estado vazio ou ativos existentes.
2. Ter colaborador cadastrado, produto com estoque, chave e carro disponíveis.
3. Registrar os três tipos. Testar colaborador ausente, estoque excedido, quantidade
   fracionária, KM ausente e KM inferior ao cadastro; confirmar mensagens.
4. Confirmar item/colaborador/data UTC/status e estoque/disponibilidade nos cadastros.
5. Devolver produto/chave integralmente e carro com KM de retorno. Filtrar Devolvidos.
6. Testar paginação com mais de dez linhas e filtros de tipo/status preservados.
7. USER sem can_lend não vê novo empréstimo; sem can_return não vê devolução;
   sem leitura vê acesso negado. USER comum vê seus empréstimos; visão ampliada
   permite os demais conforme RLS. Revogar flag em sessão aberta e testar ação.
8. Verificar teclado (Tab, Escape, foco devolvido ao gatilho), modal em tela pequena,
   clique duplo e erro de rede. Retry deve manter UUID/payload e não duplicar saída.