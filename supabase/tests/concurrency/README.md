# Cenários independentes — nenhum foi executado

- `rollback/`: contenção do bootstrap com A e B terminando em ROLLBACK.
- `commit/`: cenários existentes que exigem COMMIT manual em A; autorização posterior obrigatória.
- Observador comum: `commit/observe_wait.sql` é somente leitura, reutilizável nos dois grupos.

Não há executor automático destes diretórios no runner hospedado. Nunca usar credencial de
bypass como prova de acesso API. SQL simula identidade de sessão, não assinatura de JWT.

## Rollback, antes de consumir o bootstrap

Exige dois UUIDs fictícios Auth distintos já existentes por mecanismo separadamente autorizado;
nenhum script provisiona usuários. Confirmar fundação vazia e bootstrap não utilizado.
Em duas sessões psql interativas conectadas ao projeto autorizado, fornecer admin_a/admin_b.
Executar `rollback/bootstrap_a.sql` via `\i`: A mantém a transação aberta. Iniciar B com
`rollback/bootstrap_b.sql`. Na sessão administrativa C, executar `commit/observe_wait.sql`.
Somente depois de comprovar bloqueio, executar ROLLBACK em A. B deve concluir e reverter.
Executar `rollback/verify.sql` e comparar a versão do mutex com a evidência anterior ao teste.
Timeout/ausência de bloqueio/erro diferente são inconclusivos: ROLLBACK em ambas e registrar.

Isto comprova contenção/liberação após rollback, NÃO disputa com commit. Não usar COMMIT,
resetar marcador, desabilitar triggers ou criar fixtures em sessão concorrente sem aprovação.

## Commit — bloqueado para esta etapa

Bootstrap, último admin, revogação após espera e serialização exigem ciclo persistente aprovado.
Identidades devem ser exclusivamente fictícias; não há rollback global entre conexões.
Destinatário depende de M2, portanto não integra homologação M1.
Todos os resultados exigem SQLSTATE, bloqueio observado e estado final verificado.