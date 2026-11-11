# Marco 1 — implementação local

Data: 11/11/2026. Autorização explícita do cliente para iniciar Fase 3, Marco 1. Este registro atualiza o estado documental anterior, sem alterar o mapa recuperado.

## Decisões do MVP

- D01: matriz e limited_access da seção 4 aprovados; perfis legados sem flags continuam negados.
- D02: estoque apenas qtd. `/product-codes` mostra “Funcionalidade em desenvolvimento”; nenhuma tabela/lógica de exemplar.
- D03: devolução somente integral; parcial/faltantes fora do MVP.
- D06: nome Carro e fórmula com NULL quando odômetro ausente aprovados; migração da expressão fica no marco específico após inventário remoto das dependências.
- D08: Inativar Conta substitui exclusão física. Base adiciona is_active e bloqueia DELETE. Rotina/UI de inativação ficará no marco de perfil, com proteção do último ADMIN antes de qualquer liberação de escrita.
- D04/D05/D07/D09–D13: bloqueios seguros conforme PDD. Sem vínculo acadêmico presumido, automação de atraso, ajuste livre de qtd, relatórios inventados, uploads sem limites ou liberação manual de bem emprestado.

## Entrega

Scaffold manual na raiz, sem substituir index.html, bundles, assets ou SQL legado. Sem checkout Git local; nenhum repositório foi inicializado/publicado. Dependências do stack solicitado e suporte mínimo de componentes instaladas com versões fixas/lockfile. Testes unitários usam Node nativo, sem Vitest/Playwright adicionados ao projeto.

Next 16 usa proxy.ts; Tailwind 4 usa tema em globals.css. Login, logout, recuperação, reset/PKCE, clientes Supabase SSR/browser, validação server-side de identidade/perfil ativo, layout responsivo, home estrutural e aviso de códigos implementados. Sem Auth Admin/service role neste marco, pois nenhuma operação administrativa foi exposta.

0002 cria somente refinamentos mínimos e trigger segura de perfil. 0003 remove políticas permissivas conhecidas, aborta se houver políticas extras nas tabelas do domínio e estabelece leitura filtrada nas 13 tabelas. Mutações permanecem negadas até os marcos correspondentes. Nenhuma migration aplicada. Tipagem gerada do banco remoto não é alegada; não há catálogo autorizado/configurado disponível.

## Evidências e gates pendentes

Validação local: lint, TypeScript, 4 testes unitários e build passaram. Navegador: login/recuperação carregam com formulário desabilitado sem configuração; home/códigos redirecionam; reset sem configuração é bloqueado; callback não aceita destino externo; viewport 390px sem overflow horizontal.

Revalidação final com instalação limpa `npm ci`: lint, 4 testes, build e typecheck passaram; `npm audit --omit=dev` reportou zero vulnerabilidades. ESLint fixado em 9.39.5 para compatibilidade declarada dos plugins de eslint-config-next; npm informa fim de suporte dessa versão. Atualização conjunta do lint permanece como débito técnico de desenvolvimento, sem forçar peers incompatíveis. A primeira reinstalação encontrou arquivo SWC bloqueado pelo servidor de teste; processo encerrado e instalação repetida com sucesso.

SQL transacional criado em `C:\Projetos\Uniguacu\supabase\tests\marco1_security.sql`, não executado: sem PostgreSQL/Docker/Supabase CLI local. Ausência de credenciais de desenvolvimento impede login/logout real, e-mail/PKCE e RLS/API com identidades reais. CI preparada, não executada no GitHub. Preview Vercel não publicado. Marco iniciado e base local entregue; aceite completo depende desses gates, sem antecipar Marco 2.