import { Brand } from "@/ui/Brand";
import { requireCtx } from "@/server/auth/session";
import { AppNav } from "@/ui/AppNav";
import { ThemeToggle } from "@/ui/ThemeToggle";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireCtx();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl md:gap-8 md:px-6">
      <aside className="no-print hidden w-56 shrink-0 py-6 md:block">
        <Brand className="mb-6 px-3" />
        <AppNav />
        <ThemeToggle className="mt-6" />
      </aside>
      <div className="min-w-0 flex-1 pb-24 md:pb-10">
        <header className="no-print sticky top-[env(safe-area-inset-top)] z-20 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-2.5 backdrop-blur md:hidden">
          <Brand />
          <ThemeToggle className="-mr-2" />
        </header>
        {children}
      </div>
      <div className="md:hidden">
        <AppNav />
      </div>
    </div>
  );
}
