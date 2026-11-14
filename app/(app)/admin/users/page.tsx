import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { UserForm } from "@/components/users/user-form";
import type { UserRow } from "@/lib/users/schema";

export const metadata = { title: "Usuários" };
export default async function UsersPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const actor = await requireAdmin();
  const raw = Number((await searchParams).page ?? 1);
  const page = Number.isSafeInteger(raw) && raw > 0 && raw < 100000 ? raw : 1;
  const client = await createClient();
  const { data, count, error } = await client.from("usuarios").select("id,name,email,role,is_active,limited_access", { count: "exact" }).order("name").order("id").range((page - 1) * 20, page * 20 - 1);
  return <section><Link href="/admin" className="text-sm underline">← Painel Admin</Link><h1 className="display-heading mt-5 text-4xl">Usuários</h1><p className="mt-3 text-sm text-muted-foreground">Contas ativas e inativas. Alterações de papel e permissões têm efeito nas próximas operações.</p>
    <details className="my-6 rounded-xl border border-border bg-card p-6"><summary className="cursor-pointer text-lg font-bold">Novo Usuário</summary><div className="mt-5 max-w-xl"><UserForm /></div></details>
    {error ? <p role="alert">Não foi possível carregar os usuários. Atualize a página.</p> : <><p className="mb-4 text-sm">{count ?? 0} usuário(s)</p><div className="grid gap-4 lg:grid-cols-2">{(data as UserRow[] | null)?.map((user) => <article key={user.id} className="min-w-0 rounded-xl border border-border bg-card p-6"><h2 className="break-words text-xl font-bold">{user.name}{actor.id === user.id ? " (você)" : ""}</h2><p className="my-2 break-all text-sm text-muted-foreground">{user.email}</p><p className="text-sm font-semibold">{user.role} · {user.is_active ? "Ativo" : "Inativo"}</p><details className="mt-4"><summary className="cursor-pointer text-sm font-semibold underline">Editar papel e permissões</summary><div className="mt-5"><UserForm user={user} /></div></details></article>)}</div>{!data?.length && <p className="my-5">Nenhum usuário nesta página.</p>}<nav aria-label="Paginação de usuários" className="mt-6 flex flex-wrap items-center gap-4">{page > 1 && <Link href={`/admin/users?page=${page - 1}`} className="underline">Anterior</Link>}<span>Página {page}</span>{page * 20 < (count ?? 0) && <Link href={`/admin/users?page=${page + 1}`} className="underline">Próxima</Link>}</nav></>}
  </section>;
}