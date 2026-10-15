"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Inicio", icon: "M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/viajes", label: "Mis viajes", icon: "M4 7h16M4 12h16M4 17h10" },
  { href: "/viajes/nuevo", label: "Viaje nuevo", icon: "M12 5v14M5 12h14" },
  { href: "/configuracion", label: "Configuración", icon: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8 4-2 1 1 2-2 2-2-1-1 2h-4l-1-2-2 1-2-2 1-2-2-1V10l2-1-1-2 2-2 2 1 1-2h4l1 2 2-1 2 2-1 2 2 1z" },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  if (href === "/viajes") return path === "/viajes" || (path.startsWith("/viajes/") && !path.startsWith("/viajes/nuevo"));
  return path.startsWith(href);
}

export function AppNav() {
  const path = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:static md:inset-auto md:border-t-0 md:bg-transparent md:pb-0"
    >
      <ul className="grid grid-cols-4 md:flex md:flex-col md:gap-1">
        {ITEMS.map((item) => {
          const active = isActive(path, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-medium md:min-h-11 md:flex-row md:justify-start md:gap-3 md:rounded-xl md:px-3 md:text-base ${
                  active ? "text-route md:bg-route-soft" : "text-ink-soft hover:text-ink"
                }`}
              >
                <svg viewBox="0 0 24 24" className="size-6 md:size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={item.icon} />
                </svg>
                <span className="text-center leading-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
