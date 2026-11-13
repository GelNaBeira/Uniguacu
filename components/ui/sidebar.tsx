"use client";

// Composição shadcn/ui adaptada ao tema e aos componentes instalados do projeto.
import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Slot } from "@radix-ui/react-slot";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarContextValue = {
  open: boolean;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};
const SidebarContext = React.createContext<SidebarContextValue | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) throw new Error("useSidebar requer SidebarProvider.");
  return context;
}

function SidebarProvider({ children, className, defaultOpen = true, ...props }: React.ComponentProps<"div"> & { defaultOpen?: boolean }) {
  const [open, setOpen] = React.useState(defaultOpen);
  const [openMobile, setOpenMobile] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => {
      setIsMobile(media.matches);
      if (!media.matches) setOpenMobile(false);
    };
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  const toggleSidebar = React.useCallback(() => {
    if (isMobile) setOpenMobile((value) => !value);
    else setOpen((value) => !value);
  }, [isMobile]);

  return <SidebarContext.Provider value={{ open, openMobile, setOpenMobile, isMobile, toggleSidebar }}>
    <div data-slot="sidebar-wrapper" className={cn("flex min-h-dvh w-full", className)} {...props}>{children}</div>
  </SidebarContext.Provider>;
}

function Sidebar({ children, className, ...props }: React.ComponentProps<"aside">) {
  const { open, openMobile, setOpenMobile, isMobile } = useSidebar();
  const panelClass = cn("flex h-full w-72 flex-col bg-primary text-primary-foreground", className);
  if (isMobile) return <Dialog.Root open={openMobile} onOpenChange={setOpenMobile}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50" />
      <Dialog.Content data-slot="sidebar" data-mobile="true" className={cn(panelClass, "fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] shadow-xl outline-none")}>
        <Dialog.Title className="sr-only">Menu do almoxarifado</Dialog.Title>
        <Dialog.Description className="sr-only">Navegue pelos cadastros e recursos da instituição.</Dialog.Description>
        <Dialog.Close className="absolute right-3 top-3 rounded-md px-3 py-2 text-white/80 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white" aria-label="Fechar menu">×</Dialog.Close>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;

  return <div data-state={open ? "expanded" : "collapsed"} className={cn("relative hidden shrink-0 transition-[width] duration-200 motion-reduce:transition-none md:block", open ? "w-72" : "w-0")}>
    <aside data-slot="sidebar" aria-label="Menu lateral" inert={!open} className={cn(panelClass, "fixed inset-y-0 left-0 z-30 transition-transform duration-200 motion-reduce:transition-none", !open && "-translate-x-full")} {...props}>{children}</aside>
  </div>;
}

function SidebarTrigger({ className, onClick, ...props }: React.ComponentProps<typeof Button>) {
  const { toggleSidebar, open, openMobile, isMobile } = useSidebar();
  return <Button type="button" variant="ghost" size="sm" aria-label="Alternar menu lateral" aria-expanded={isMobile ? openMobile : open} className={cn("shrink-0", className)} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented) toggleSidebar(); }} {...props}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /></svg>
    <span className="sr-only">Menu</span>
  </Button>;
}
function SidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-header" className={cn("shrink-0 px-7 pb-8 pt-10", className)} {...props} />;
}
function SidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-content" className={cn("min-h-0 flex-1 overflow-y-auto px-4 py-2", className)} {...props} />;
}
function SidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sidebar-footer" className={cn("shrink-0 border-t border-white/10 px-7 py-6", className)} {...props} />;
}
function SidebarMenu({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu" className={cn("flex flex-col gap-2", className)} {...props} />;
}
function SidebarMenuItem(props: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-item" {...props} />;
}
function SidebarMenuButton({ asChild = false, isActive = false, className, ...props }: React.ComponentProps<"button"> & { asChild?: boolean; isActive?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp data-slot="sidebar-menu-button" data-active={isActive} className={cn("flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white data-[active=true]:bg-white/10 data-[active=true]:text-white", className)} {...props} />;
}
function SidebarMenuSub({ className, ...props }: React.ComponentProps<"ul">) {
  return <ul data-slot="sidebar-menu-sub" className={cn("mb-2 ml-5 mt-1 space-y-1 border-l border-white/20 pl-4", className)} {...props} />;
}
function SidebarMenuSubItem(props: React.ComponentProps<"li">) {
  return <li data-slot="sidebar-menu-sub-item" {...props} />;
}
function SidebarMenuSubButton({ asChild = false, isActive = false, className, ...props }: React.ComponentProps<"a"> & { asChild?: boolean; isActive?: boolean }) {
  const Comp = asChild ? Slot : "a";
  return <Comp data-slot="sidebar-menu-sub-button" data-active={isActive} className={cn("flex min-h-10 items-center rounded-md px-3 py-2 text-sm text-white/70 transition-colors hover:bg-white/5 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:font-semibold data-[active=true]:text-[#e6cf94]", className)} {...props} />;
}

export { Sidebar, SidebarProvider, SidebarTrigger, SidebarHeader, SidebarContent, SidebarFooter, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton, useSidebar };