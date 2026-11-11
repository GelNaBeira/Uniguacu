# Auth/API — plano futuro, sem executor e sem usuários criados

Requer autorização própria para provisionar identidades fictícias via Supabase Auth:
admin A/B, comum ativo, inativo, admin desativado e Auth sem acesso operacional.
Não inserir senhas, tokens, emails reais ou chaves privilegiadas nos arquivos/evidências.
Fixtures mínimas de auth.users das suítes SQL NÃO são usuários de login e não as substituem.

Usar JWTs emitidos por Auth e chamadas HTTPS à RPC set_operator_access no projeto autorizado.
Confirmar sucesso administrativo válido como controle positivo, com evento auditado.
Exigir negativa para: anônimo, comum promovendo a si/outro, criação de admin, revogação de admin,
inativo, não cadastrado e admin desativado com token ainda válido. Metadados editáveis não
devem alterar autorização. Conferir SQLSTATE 42501 no corpo retornado quando aplicável,
status HTTP registrado e ausência de efeitos parciais em acesso/auditoria/mutex/bootstrap.

Testar também RLS direto, bloqueio de escrita de papéis/auditoria, login/refresh/logout e
expiração. Não assumir que logout invalida imediatamente todo access token já emitido.
Nunca usar postgres/service_role para representar usuário comum; inspeção privilegiada do
estado antes/depois deve estar em canal separado. Não tentar forjar JWT como teste SQL.
Security Advisor: registrar a RPC SECURITY DEFINER executável por authenticated como
superfície intencional com autorização interna, ainda pendente destas evidências.