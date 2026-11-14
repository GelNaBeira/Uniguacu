import Link from "next/link";
import { requireAdmin } from "@/lib/auth/session";
import { ReportDownload } from "@/components/reports/report-download";
export const metadata = { title: "Painel Admin" };
export default async function AdminPage() {
  await requireAdmin();
  return <section className="max-w-3xl rounded-xl border border-border bg-card p-8"><h1 className="display-heading text-4xl">Painel Admin</h1><p className="my-5 text-muted-foreground">Administre o acesso ao almoxarifado. As contas inativas mantêm seu histórico.</p><Link href="/admin/users" className="inline-flex rounded-md bg-primary px-5 py-3 font-semibold text-primary-foreground">Gerenciar usuários</Link><div className="mt-8 border-t border-border pt-6"><h2 className="text-xl font-semibold">Relatório geral</h2><p className="my-3 text-sm text-muted-foreground">Histórico de todos os empréstimos, devoluções, consumos e entradas de estoque auditadas. Exclusivo para ADMIN.</p><ReportDownload request={{ scope: "general" }} /></div></section>;
}