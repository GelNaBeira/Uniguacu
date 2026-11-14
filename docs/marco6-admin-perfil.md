# Marco 6 — etapa 1: Administração, Perfil e Ajuda

## Implantação

1. Em ambiente autorizado e com backup, aplicar integralmente `supabase/migrations/0012_admin_profile.sql` após a 0011 e, em seguida, `supabase/migrations/0013_admin_deactivation.sql`. Esta entrega não aplica migrações remotas automaticamente. A 0013 é obrigatória para revogar a auto-inativação de clientes antigos.
2. Configurar `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente do servidor e reiniciar/reimplantar. Nunca usar prefixo `NEXT_PUBLIC_` nem versionar seu valor. Perfil e permissões usam a sessão do usuário, não essa chave.
3. Manter signup público desabilitado no Supabase Auth, conforme previsto no projeto.
4. Testar `/perfil`, `/admin`, `/admin/users` e `/help`. `/profile` redireciona para `/perfil` por compatibilidade.

## Segurança e comportamento

- Layout, páginas e Server Actions administrativas verificam perfil ativo e ADMIN no servidor. A lista usa RLS; a edição usa RPC com autorização SQL.
- Auth Admin cria a conta com senha inicial de no mínimo 12 caracteres e e-mail confirmado pelo administrador. Entregar a senha por canal seguro; a recuperação de senha existente permite sua troca.
- O gate SQL usa a sessão autenticada. O trigger Auth revalida o administrador de `app_metadata.provisioning`, valida as permissões e insere o perfil na mesma transação do Auth. Metadados editáveis do usuário não concedem autorização.
- USER novo inicia sem permissões; os checkboxes explicitam o acesso. ADMIN ignora flags. Alterar a role não reativa contas.
- Lock transacional serializa alterações de acesso/inativação; o último ADMIN ativo não pode ser removido. Não há exclusão de contas/histórico.
- Ninguém pode inativar a própria conta (ADMIN ou USER). Somente ADMIN ativo inativa terceiros em `/admin/users`, com confirmação. A Server Action, a RPC e o trigger verificam essa regra; o perfil não oferece inativação. O ADMIN permanece conectado; sessões da conta alvo são bloqueadas pelo perfil inativo nas próximas operações.
- Fotos usam bucket privado, caminhos do próprio usuário, validação de tamanho/MIME/assinatura e URLs temporárias. Fotos anteriores ficam preservadas para evitar remover substituições concorrentes; limpeza de órfãos pode ser planejada separadamente.
- Erros do Auth não retornam senha, chave ou objetos internos. Em resposta incerta de criação, consultar a lista antes de repetir; e-mail único impede duplicação da conta.

## Homologação autenticada

- ADMIN: listar todas as páginas, criar USER e conferir login, role e flags.
- USER: acessar `/admin` e `/admin/users` diretamente e tentar ações administrativas; deve ser negado sem alteração.
- Perfil: alterar nome/foto, rejeitar imagens inválidas e maiores que 3 MB; não alterar role ou dados alheios.
- ADMIN inativa USER com histórico: verificar `is_active=false` e bloqueio de login/sessão antiga do alvo, preservando histórico e a sessão do ADMIN.
- Com dois ADMIN, confirmar auto-inativação negada e inativação do outro permitida. USER não pode inativar ninguém. RPC antiga e chamadas diretas devem ser negadas. Com apenas um ADMIN, confirmar rejeição de rebaixamento/inativação. Testar concorrência em homologação.
- Conferir mobile, teclado, mensagens, Ajuda e compatibilidade de `/profile`.

Sem PostgreSQL/Supabase local disponível, os testes Node verificam contratos e validações; não substituem a execução das RPCs e RLS em homologação.