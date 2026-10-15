"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  ["", "Resumen"],
  ["/transporte", "Transporte"],
  ["/alojamiento", "Alojamiento"],
  ["/actividades", "Actividades"],
  ["/comparador", "Comparador"],
  ["/confirmar", "Confirmar"],
  ["/itinerario", "Itinerario"],
  ["/gastos", "Gastos"],
] as const;

export function TripTabs({ base }: { base: string }) {
  const path = usePathname();
  return (
    <nav aria-label="Secciones del viaje" className="no-print -mx-4 overflow-x-auto border-b border-line px-4 md:mx-0 md:px-0">
      <ul className="flex min-w-max gap-1">
        {TABS.map(([suffix, label]) => {
          const href = `${base}${suffix}`;
          const active = suffix === "" ? path === base || path === `${base}/editar` : path.startsWith(href);
          return (
            <li key={suffix}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center border-b-[3px] px-3 font-medium ${
                  active ? "border-route text-ink" : "border-transparent text-ink-soft hover:text-ink"
                }`}
              >
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
