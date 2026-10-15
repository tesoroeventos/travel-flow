"use client";

import { useTransition } from "react";
import { buttonClass } from "./Button";

/** Botón que pide confirmación antes de ejecutar una acción destructiva. */
export function ConfirmButton({
  action,
  label,
  confirm,
  variant = "danger",
  className = "",
}: {
  action: () => Promise<void>;
  label: string;
  confirm: string;
  variant?: "danger" | "secondary" | "ghost";
  className?: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass(variant, className)}
      onClick={() => {
        if (window.confirm(confirm)) start(() => action());
      }}
    >
      {pending ? "Procesando…" : label}
    </button>
  );
}
