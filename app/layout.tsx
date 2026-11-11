import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: { default: "Almoxarifado · Uniguaçu", template: "%s · Almoxarifado" }, description: "Almoxarifado Uniguaçu — Foz do Iguaçu", robots: { index: false, follow: false } };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><a className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-4" href="#main">Pular para o conteúdo</a>{children}</body></html>;
}