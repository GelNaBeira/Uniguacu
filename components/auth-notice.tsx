const messages: Record<string, string> = {
  configuration: "Os campos estão desabilitados porque a configuração do Supabase está incompleta ou inválida. Confira NEXT_PUBLIC_SUPABASE_URL (URL HTTPS do projeto) e NEXT_PUBLIC_SUPABASE_ANON_KEY (chave pública anon ou publishable) no .env.local e reinicie o servidor.",
  invalid: "Não foi possível concluir. Confira os dados informados e tente novamente.",
  access: "Acesso indisponível. Procure a administração para verificar seu perfil.",
  sent: "Se o e-mail estiver cadastrado, você receberá as instruções para recuperar o acesso.",
  expired: "O link é inválido ou expirou. Solicite uma nova recuperação.",
  reset: "Senha atualizada. Entre novamente com sua nova senha.",
};
export function AuthNotice({ status }: { status?: string }) {
  if (!status || !messages[status]) return null;
  return <p role="status" className="mb-6 rounded-md border border-border bg-muted p-4 text-sm leading-6">{messages[status]}</p>;
}