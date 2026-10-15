import { currentUser, requireCtx } from "@/server/auth/session";
import { logoutAction } from "@/server/actions/auth";
import { deleteRateAction } from "@/server/actions/expenses";
import { getDb } from "@/server/db";
import { makeRepos } from "@/server/repos";
import { ThemeToggle } from "@/ui/ThemeToggle";
import { RateForm } from "@/ui/RateForm";
import { ConfirmButton } from "@/ui/ConfirmButton";
import { fmtDate, fmtRate } from "@/ui/format";

export const metadata = { title: "Configuración · TravelFlow" };

export default async function SettingsPage() {
  const ctx = await requireCtx();
  const [user, rates] = await Promise.all([currentUser(), getDb().then((db) => makeRepos(db).rates.list(ctx))]);
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
        <h2 className="font-display text-xl font-semibold">Tipos de cambio</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-soft">
          Se usan para convertir precios y gastos a la moneda de cada viaje. Para cada fecha se toma la tasa más reciente vigente. No se encadenan conversiones.
        </p>
        {rates.length > 0 ? (
          <div className="mt-3 overflow-x-auto">
            <table aria-label="Tipos de cambio" className="num w-full text-sm">
              <thead>
                <tr className="border-b border-line text-ink-soft">
                  <th scope="col" className="py-2 text-left font-medium">Tasa</th>
                  <th scope="col" className="py-2 text-left font-medium">Desde</th>
                  <th scope="col" className="py-2 text-left font-medium">Fuente</th>
                  <th scope="col" className="py-2"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {rates.map((r) => (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="py-2 pr-2">
                      1 {r.fromCurrency} = {fmtRate(r.rate)} {r.toCurrency}
                    </td>
                    <td className="py-2 pr-2">{fmtDate(r.asOf)}</td>
                    <td className="py-2 pr-2">{r.source}</td>
                    <td className="py-2 text-right">
                      <ConfirmButton variant="ghost" action={deleteRateAction.bind(null, r.id)} label="Quitar" confirm="¿Quitar este tipo de cambio?" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <RateForm />
      </section>

      <section className="mt-4 rounded-lg border border-line bg-surface p-4">
        <h2 className="font-display text-xl font-semibold">Apariencia</h2>
        <ThemeToggle className="-ml-3 mt-1" />
      </section>
    </main>
  );
}
