import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Almoxarifado · Uniguaçu", template: "%s · Almoxarifado" }, description: "Almoxarifado Uniguaçu — Foz do Iguaçu", robots: { index: false, follow: false } };
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Per-request CSP nonces must not be cached in statically generated HTML.
  await connection();
  return <html lang="pt-BR"><body><a className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4" href="#main">Pular para o conteúdo</a>{children}</body></html>;
}