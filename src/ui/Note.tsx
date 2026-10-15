import type { ReactNode } from "react";

/** Aviso corto: "info" en verde, "warn" en amarillo. */
export function Note({
  tone = "info",
  children,
  className = "",
}: {
  tone?: "info" | "warn";
  children: ReactNode;
  className?: string;
}) {
  const style =
    tone === "warn"
      ? "bg-signal-soft border-signal-line/50"
      : "bg-route-soft border-transparent";
  return (
    <div
      className={`flex items-start gap-2.5 rounded-2xl border px-4 py-3 text-[0.95rem] ${style} ${className}`}
      role={tone === "warn" ? "status" : undefined}
    >
      <svg
        viewBox="0 0 24 24"
        className={`mt-0.5 size-5 shrink-0 ${tone === "warn" ? "text-signal" : "text-route"}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden
      >
        {tone === "warn" ? (
          <path d="M12 3 2 20h20zM12 10v4M12 17h.01" />
        ) : (
          <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01" />
        )}
      </svg>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
