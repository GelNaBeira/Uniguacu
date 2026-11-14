# Almoxarifado Uniguaçu

Next.js 16/App Router, React 19, TypeScript, Tailwind 4 e Supabase Auth/Postgres/Storage. Raiz: `C:\Projetos\Uniguacu`. Captura Angular legada preservada; não é servida pelo App Router.

## Instalação

Node 22.18+ (ou Node 24), npm e projeto Supabase isolado.

```powershell
Set-Location C:\Projetos\Uniguacu
npm ci
Copy-Item .env.example .env.local
# Preencher variáveis sem versionar os valores.
npm run dev
```

Primeiro ADMIN: provisionamento por TI via Auth Admin/painel e promoção controlada no banco. Não existe bootstrap público ou seed com senha. Demais usuários são geridos pelo Painel Admin; perfil próprio não pode promover papel/permissões.

## Banco e migrations

1. Fazer backup, ensaiar restauração e confrontar schema, triggers, funções, policies e grants com o destino.
2. Em projeto **novo e isolado**, revisar/aplicar `C:\Projetos\Uniguacu\supabase\migrations\0001_initial_schema.sql` até `C:\Projetos\Uniguacu\supabase\migrations\0015_security_hardening.sql`, em ordem, **EXCLUINDO `C:\Projetos\Uniguacu\supabase\migrations\0006a_reset_products.sql` (destrutiva, não faz parte da instalação)**. Existem precondições e migrations não reaplicáveis: homologar a sequência antes de produção.
3. Em projeto existente, aplicar apenas pendentes após confrontar o histórico remoto. A `0014` já está instalada no Uniguacu (`nfpptemkkgjdagcpuhfv`) como `20261114175607`; **não reaplicar**.
4. A `0015_security_hardening.sql` está **aplicada remotamente** no Uniguacu como `20261114220332`, confirmado via MCP. Não reaplicar. Revoga execução pública do event trigger `rls_auto_enable` e cria quota persistente por usuário. Não apaga dados de negócio ou Storage.
5. Teste remoto transacional com role `authenticated` e identidade ADMIN simulada aprovado: empréstimos 1–30 permitidos/31 bloqueado e relatórios 1 permitido/2 bloqueado, com rollback dos contadores. Isso não substitui testes HTTP autenticados, isolamento de permissões e concorrência real. Sem a RPC da quota, relatórios e empréstimos falham fechados.
6. Não executar indiscriminadamente os SQLs em `C:\Projetos\Uniguacu\supabase\tests`: há contratos antigos. Revisar e rodar em projeto descartável, sem service role nos testes de RLS.

## Checklist de deploy — Vercel + Supabase

### Variáveis Vercel

| Variável | Valor / cuidado |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS do projeto correto para o ambiente. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave pública anon ou publishable, nunca service role. |
| `SUPABASE_SERVICE_ROLE_KEY` | Segredo somente servidor para provisionamento no Painel Admin. Marcar Sensitive; nunca prefixar `NEXT_PUBLIC_`, logar ou versionar. Ignora RLS: uso restrito à API Admin após gates de autorização. |
| `APP_URL` | Origem HTTPS canônica do domínio **real**, sem caminho/query/fragmento. Substituir o localhost do exemplo. Usada na recuperação, nunca derivada de Host enviado pelo usuário. |

- Production e Preview separados; Preview usa Supabase de homologação. Não compartilhar segredo de produção com PRs/branches não confiáveis.
- Framework Next.js, Node 24, instalação `npm ci`, build `npm run build`. Proteger previews; não publicar código-fonte nem listagem de diretórios.
- Reconstruir após alterar variáveis (as públicas entram no bundle no build). Rotacionar segredos expostos; MFA e menor privilégio em Git/Vercel/Supabase.

### Auth: redirects, SMTP e força bruta

No Supabase, **Authentication → URL Configuration**:
- Site URL = mesma origem HTTPS real de `APP_URL`.
- Redirect URLs = origem real + `/auth/callback`, **URL exata**. Evitar wildcards amplos em produção.
- `http://localhost:3000/auth/callback` apenas no projeto de desenvolvimento; remover previews/localhost desnecessários de produção.
- Desabilitar cadastro público e login anônimo; configurar SMTP/remetente/templates e testar entrega. Recuperação PKCE exige o mesmo navegador que solicitou o link; callback não aceita destino externo arbitrário.

Em **Authentication → Rate Limits**, revisar cotas disponíveis por endpoint (refresh, verificação, recuperação/OTP e e-mail), ajustar ao volume legítimo e monitorar HTTP 429. Limite de refresh **não equivale** a limite de tentativas de senha. Não aumentar limites só para esconder erros.

Login/recuperação passam por Server Actions: o provedor pode enxergar IP de saída compartilhado do servidor. Testar usuários legítimos e tentativas inválidas/429; complementar com WAF/rate limiting de POSTs de autenticação na borda. Não confiar em `X-Forwarded-For` arbitrário nem inserir service role no cliente de login para contornar cotas. Quota por usuário autenticado não protege login.

Em **Authentication → Sign In / Providers → Email**, configurar mínimo de **12 caracteres**. Criação de usuários e recuperação na aplicação exigem esse mínimo; a configuração global do Auth **ainda precisa ser confirmada no painel**, pois o MCP disponível não altera essa configuração. Proteção contra senhas vazadas indisponível no Free: **risco residual aceito pelo responsável**, sem upgrade. Senhas maiores não equivalem à consulta de vazamentos. CAPTCHA é camada adicional: **não ativar sem integrar/testar envio do token**, para não quebrar Auth. CAPTCHA não foi implementado nesta entrega.

Referências oficiais: `https://supabase.com/docs/guides/auth/rate-limits`, `https://supabase.com/docs/guides/auth/password-security`, `https://supabase.com/docs/guides/auth/redirect-urls`.

### Controles aplicados / verificados

- CSP com nonce aleatório por requisição no Proxy, repassado ao renderizador Next.js; sem `unsafe-inline`/`unsafe-eval` para scripts em produção. Renderização dinâmica e `private, no-store` evitam HTML estático com nonce reutilizado. Baseline também em `C:\Projetos\Uniguacu\next.config.ts`.
- X-Frame-Options DENY, frame-ancestors none, nosniff, Referrer-Policy, Permissions-Policy e HSTS de um ano em produção. Sem preload/includeSubDomains antes de inventariar subdomínios.
- Concessão CSP: estilos inline necessários aos componentes/Radix; **não libera scripts inline**. Origem externa restrita ao Supabase configurado; data/blob para previews. Eval/WebSocket só em desenvolvimento.
- Rate limit persistente/atômico PostgreSQL, sem dependências extras ou Map em memória: **1 relatório/20 segundos** e **30 empréstimos/devoluções/60 segundos por usuário**. Compartilhado entre instâncias; erro nega operação. RPC deriva `auth.uid()`, verifica conta ativa/permissões e não aceita ator/quota/janela do cliente.
- Limitação: protege Server Actions, **não é antiddos global nem impede chamadas diretas às RPCs de domínio ou uploads via API Supabase**. Não garante exclusão mútua de relatórios que durem mais de 20 segundos. Complementar com WAF/monitoramento/cotas e teste de carga.
- Relatórios limitam seções a 10.000 registros e saída base64 a 24 MiB. PDFs são gerados, não recebidos por upload. Checar tamanho final não elimina custo de renderização.
- Zod no servidor para dados de formulários/Auth/Admin/domínio; tamanho/MIME/assinatura de conteúdo para uploads. React escapa textos; nenhum HTML bruto/eval encontrado no código da aplicação. Excel usa texto, não objetos de fórmula/hyperlink.
- Service role em módulo server-only. Domínio/relatórios usam sessão e RLS; autorização não depende somente da UI.

### Inspeção remota Supabase (somente leitura)

- **13/13 tabelas públicas com RLS:** products, operations, car_key_lends, sectors, suppliers, collaborators, usuarios, categories, academics, key_lends, lendies, keys, car_keys.
- **Zero policies de escrita incondicional true** em public/storage. `PERMISSIVE` é modo de composição, não sinônimo de acesso irrestrito. Empréstimos/operações negam DML direto e usam RPCs.
- RPCs de negócio SECURITY DEFINER têm search_path fixo e verificam identidade ativa/permissões internamente: `auth.uid()`, `private.is_admin`, `private.has_permission`, `private.lending_actor`. Perfil escreve somente no UID próprio; auto-inativação é negada. Event trigger `rls_auto_enable` é infraestrutura, não RPC de negócio; sua execução pública desnecessária será revogada na `0015`.
- Buckets `product-images`/`profile-images` **privados**, **3 MiB**, JPEG/PNG/WebP. Produto: INSERT exige ADMIN ou leitura+gestão, produto existente e caminho válido. Perfil: INSERT exige UID dono da pasta e ativo. Nenhuma policy UPDATE Storage encontrada; uploads sem upsert.
- DELETE produto exige gestão, caminho válido e arquivo sem referência (não exige can_delete). Perfil referenciado não pode ser excluído. URLs assinadas têm acesso temporário; não expor em logs.

### Advisor: avisos ainda pendentes

| Aviso | Situação / ação |
| --- | --- |
| `anon_security_definer_function_executable`: rls_auto_enable | **Resolvido**, ausente no Advisor após `0015`. EXECUTE negado a anon/authenticated, preservando event trigger. |
| `authenticated_security_definer_function_executable` | 13 funções apontadas: 12 RPCs de negócio + quota. Revisar autorização como acesso intencional. Não converter para INVOKER/revogar indiscriminadamente quebrando operações. |
| `auth_leaked_password_protection` | **Desabilitada remotamente; risco aceito no Free**. Mínimo de 12 na aplicação; confirmar configuração global no painel. |
| `rls_enabled_no_policy` | Informativo esperado em `private.action_rate_limits`: sem acesso direto de anon/authenticated; consumo via RPC. |

Remediação: `https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable`, `https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable`, `https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection`.

Advisor reconsultado via MCP: sem alerta de execução anônima do event trigger; permanecem os avisos descritos acima. O serviço retornou timestamps posteriores à data local do ambiente; preservar versões remotas literalmente, sem usá-las como data local de execução.

### Gates antes da liberação

- [x] `0015` aplicada e teste sequencial transacional remoto aprovado.
- [x] Limitação de proteção contra senhas vazadas aceita no plano Free pelo responsável.
- [ ] Backup/restauração; testar quotas concorrentes e isolamento no Postgres.
- [ ] Confirmar mínimo global de 12 caracteres no Supabase Auth, revisar grants/Advisor e validar Auth/WAF/429.
- [ ] Testes reais anon/USER/ADMIN/inativo via API, sem service role: RLS, RPCs, escalada de permissões e uploads fora da pasta/bucket.
- [ ] E2E autenticado de remoção/undo/substituição de fotos, concorrência e falha de limpeza com editor sem can_delete. Nenhum arquivo real foi excluído nesta auditoria.
- [ ] Login/logout/recuperação com SMTP e domínio definitivo/redirect allowlist exata.
- [ ] Preview HTTPS: headers, CSP e console em telas autenticadas; smoke público não substitui E2E.
- [ ] Monitoramento, alertas de abuso, retenção, revisão de acesso e teste de carga.
- [ ] Executar validações abaixo e reauditar dependências na data de liberação.

```powershell
Set-Location C:\Projetos\Uniguacu
npm test
npm run typecheck
npm run lint
npm run build
npm audit --omit=dev
```

Testes incluem validação/autorização, PDF/XLSX, headers/CSP e fail-closed do limitador. Asserções estruturais SQL **não substituem execução de migrations ou testes RLS/concorrência no Postgres**. Isto não é pentest completo ou certificação OWASP. Com gates pendentes, **produção não está aprovada**.

## Evidências desta entrega

- `npm test`: 171 testes aprovados, zero falhas.
- Typecheck, lint e build de produção aprovados; auditoria npm de dependências de produção sem vulnerabilidades conhecidas no momento da execução.
- Smoke real com `next start` na porta 3100: login HTTP 200, cinco headers solicitados presentes, 14 scripts com nonce correspondente ao CSP, nonce diferente entre requisições e console sem erros/warnings.
- Atualização via MCP: histórico remoto confirma `0015` como `20261114220332`; teste sequencial da quota aprovado sob role `authenticated`, sem service role, com JWT subject simulado e rollback. Não equivale a sessão HTTP real. Nenhum registro de negócio ou arquivo Storage alterado por esse teste.
- Nenhuma dependência instalada ou deploy/push realizado. Testes HTTP autenticados e concorrência real continuam pendentes.