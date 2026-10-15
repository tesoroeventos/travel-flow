import { currentUser, requireCtx } from "@/server/auth/session";
import { logoutAction } from "@/server/actions/auth";
import { ThemeToggle } from "@/ui/ThemeToggle";

export const metadata = { title: "Configuración · TravelFlow" };

export default async function SettingsPage() {
  await requireCtx();
  const user = await currentUser();
  return (
    <main className="px-4 py-6 md:px-0">
      <h1 className="font-display text-4xl font-bold tracking-tight">Configuración</h1>

      <section className="mt-6 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Tu cuenta</h2>
        <p className="mt-1">{user?.name}</p>
        <p className="text-ink-soft">{user?.email}</p>
        <form action={logoutAction} className="mt-4">
          <button type="submit" className="min-h-11 rounded-md border border-line-strong px-4 font-semibold hover:border-route">
            Cerrar sesión
          </button>
        </form>
      </section>

      <section className="mt-4 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Apariencia</h2>
        <ThemeToggle className="-ml-3 mt-1" />
      </section>
    </main>
  );
}
