import Link from "next/link";
import { requireCtx } from "@/server/auth/session";
import { AppNav } from "@/ui/AppNav";
import { ThemeToggle } from "@/ui/ThemeToggle";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireCtx();
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl md:gap-8 md:px-6">
      <aside className="no-print hidden w-56 shrink-0 py-6 md:block">
        <Link href="/" className="block px-3 font-display text-2xl font-bold tracking-tight text-route">
          TravelFlow
        </Link>
        <div className="route-line mx-3 mt-2 mb-6 w-16" aria-hidden />
        <AppNav />
        <ThemeToggle className="mt-6" />
      </aside>
      <div className="min-w-0 flex-1 pb-24 md:pb-10">
        <header className="no-print flex items-center justify-between border-b border-line px-4 py-3 md:hidden">
          <Link href="/" className="font-display text-2xl font-bold tracking-tight text-route">
            TravelFlow
          </Link>
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
