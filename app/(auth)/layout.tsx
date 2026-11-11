import Image from "next/image";
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh lg:grid lg:grid-cols-[1fr_1.05fr]">
    <aside className="technical-grid relative hidden min-h-dvh flex-col justify-between overflow-hidden bg-primary p-14 text-white lg:flex">
      <div><span className="text-xs font-semibold tracking-[.24em]">UNIGUAÇU / FOZ DO IGUAÇU</span><div className="mt-5 h-px w-12 bg-[#d4bd81]" /></div>
      <div className="relative py-16"><p className="mb-6 text-xs tracking-[.2em] text-white/60">GESTÃO DO ALMOXARIFADO</p><h1 className="display-heading max-w-lg text-6xl leading-[1.05]">Organização que<br />faz a instituição<br /><em className="text-[#d4bd81]">seguir em frente.</em></h1><p className="mt-8 max-w-sm text-base leading-7 text-white/70">Um ponto de acesso para cuidar dos materiais e recursos do dia a dia.</p></div>
      <div className="flex justify-between border-t border-white/20 pt-6 text-xs text-white/60"><span>Patrimônio. Cuidado. Responsabilidade.</span><span>01 / ACESSO</span></div>
    </aside>
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 sm:px-12">
      <div className="w-full max-w-sm"><Image src="/images/logo-uniguacu.png" width={180} height={70} alt="Uniguaçu" className="mb-14 h-auto w-44 object-contain object-left" priority />{children}<p className="mt-12 border-t border-border pt-5 text-xs leading-5 text-muted-foreground">Almoxarifado · Foz do Iguaçu<br />Acesso exclusivo a usuários autorizados.</p></div>
    </main>
  </div>;
}