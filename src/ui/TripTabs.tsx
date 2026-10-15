"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["/opciones", "Opciones"],
  ["/propuestas", "Propuestas"],
  ["/itinerario", "Itinerario"],
  ["/gastos", "Gastos"],
] as const;

const MORE = [
  ["/editar", "Datos del viaje"],
  ["/confirmar", "Reservas y pagos"],
  ["/imprimir", "Imprimir o guardar PDF"],
  ["/exportar/presupuesto.csv", "Presupuesto (CSV)"],
  ["/exportar/itinerario.ics", "Itinerario al calendario (.ics)"],
  ["/editar#compartir", "Compartir"],
] as const;

export function TripTabs({ base }: { base: string }) {
  const path = usePathname();
  const moreActive = MORE.some(([s]) =>
    path.startsWith(`${base}${s.split("#")[0]}`),
  );
  return (
    <nav
      aria-label="Secciones del viaje"
      className="no-print flex items-center gap-1 border-b border-line"
    >
      <ul className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {TABS.map(([suffix, label]) => {
          const href = `${base}${suffix}`;
          const active = path.startsWith(href);
          return (
            <li key={suffix}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-12 items-center border-b-[3px] px-3 font-semibold whitespace-nowrap ${
                  active
                    ? "border-route text-ink"
                    : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
      <details className="relative shrink-0">
        <summary
          className={`inline-flex min-h-12 cursor-pointer list-none items-center gap-1 border-b-[3px] px-3 font-semibold [&::-webkit-details-marker]:hidden ${
            moreActive
              ? "border-route text-ink"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Más
          <span aria-hidden>▾</span>
        </summary>
        <ul className="absolute right-0 z-20 mt-1 w-64 rounded-2xl bg-surface p-1.5 shadow-card">
          {MORE.map(([suffix, label]) => (
            <li key={suffix}>
              <Link
                href={`${base}${suffix}`}
                prefetch={false}
                className="flex min-h-11 items-center rounded-xl px-3 hover:bg-route-soft"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </details>
    </nav>
  );
}
