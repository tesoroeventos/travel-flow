"use client";

import { createContext, useContext, useId, useState, type ReactNode } from "react";
import { buttonClass } from "./Button";

const CloseCtx = createContext<() => void>(() => {});
/** Permite que un formulario dentro del panel lo cierre al guardar. */
export const useCloseDisclosure = () => useContext(CloseCtx);

export function Disclosure({
  label,
  children,
  variant = "secondary",
  className = "",
  defaultOpen = false,
}: {
  label: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={className}>
      {!open ? (
        <button type="button" aria-expanded={false} aria-controls={id} className={buttonClass(variant)} onClick={() => setOpen(true)}>
          {label}
        </button>
      ) : (
        <div id={id}>
          <CloseCtx value={() => setOpen(false)}>{children}</CloseCtx>
        </div>
      )}
    </div>
  );
}
