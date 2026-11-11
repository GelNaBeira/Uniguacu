# Almoxarifado Uniguaçu — Marco 1

Raiz: `C:\Projetos\Uniguacu`. Captura Angular original preservada; não é servida pela nova aplicação.

## Desenvolvimento

Node 22.18+ (validado com Node 24), npm e dependências fixadas em lockfile.

```powershell
npm ci
Copy-Item .env.example .env.local
# Preencher .env.local com configuração de projeto Supabase isolado.
npm run dev
```

O projeto usa Next.js 16/App Router, React 19, TypeScript, Tailwind 4/PostCSS e componentes locais no padrão shadcn/ui (`components.json`). Tailwind 4 configura o tema no CSS; não precisa de tailwind.config.ts. `proxy.ts` substitui a convenção middleware.ts do plano. Nenhuma chave privilegiada é usada pelo Marco 1.

## Banco e Auth — não aplicar em produção

1. Confrontar catálogo real, políticas, triggers, funções e grants (incluindo grants por coluna) com a baseline. Os SQLs antigos em supabase/tests/phase2* não representam automaticamente o contrato novo.
2. Em banco Supabase isolado, executar migrations em ordem: 0001, 0002, 0003. Não reaplicar 0001 em banco existente. Fazer backup e ensaiar restauração antes de qualquer rollout autorizado.
3. Desabilitar **Allow new users to sign up** no painel Supabase Auth ANTES de disponibilizar a aplicação. Não existe cadastro público na UI. A trigger cria perfil USER com flags aprovadas, ignorando role/permissões de metadata. Perfis legados não recebem permissões automaticamente.
4. Configurar Site URL igual a APP_URL e permitir a URL exata `/auth/callback` no redirect allowlist de Auth. Recuperação usa PKCE e requer abrir o link no mesmo navegador que solicitou. O callback sempre leva a `/reset-password`; parâmetros `next`/destinos externos não são aceitos.
5. Primeiro ADMIN: provisionamento por TI via Auth Admin/painel, depois promoção SQL em ambiente controlado. Não há endpoint de bootstrap nem seed com senha.
6. Validar RLS como anon, USER, ADMIN e perfil inativo via API, não com service role. Consultar `supabase/tests/marco1_security.sql` para verificações estruturais locais. Não declarar segurança homologada sem testes de identidades reais.

Todas as escritas de domínio estão bloqueadas neste marco, inclusive para ADMIN pelo cliente. Não há RPC de empréstimo, cadastro, ajuste ou inativação ainda. Soft delete usa usuarios.is_active; helpers negam imediatamente perfis inativos. Exclusão física do perfil (inclusive cascade do Auth) está bloqueada. A futura ação do perfil será **Inativar Conta**, nunca deletar, com proteção transacional do último ADMIN antes de expor a rotina. Nenhum botão sem implementação foi adicionado.

## Validação

```powershell
npm run lint
npm run typecheck
npm test
npm run build
```

Sem Supabase configurado, login/recuperação exibem aviso e não enviam credenciais; rotas autenticadas redirecionam ao login. A home é estrutural, sem indicadores ou operações fictícios. `/product-codes` é apenas o aviso aprovado.

Pendências de homologação: banco isolado, testes SQL/API com identidades reais, envio de e-mail/PKCE, cenários autenticados e inativos, conferência remota da baseline, checkout/branch Git e preview Vercel. Storage/upload bloqueado até definição de MIME/tamanho. Fórmula aprovada de distance será migrada no marco de Carro após inventário de dependências. Nenhum banco remoto foi alterado.