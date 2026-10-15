"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}
const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-ink-soft hover:text-ink ${className}`}
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("tf-theme", next);
        } catch {
          /* sin almacenamiento: el cambio dura hasta recargar */
        }
      }}
    >
      <span aria-hidden className="inline-block size-4 rounded-full border-2 border-current" style={{ background: theme === "dark" ? "currentColor" : "transparent" }} />
      {next === "dark" ? "Modo oscuro" : "Modo claro"}
    </button>
  );
}
