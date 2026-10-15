"use client";

import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";
import { useFormStatus } from "react-dom";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const base =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60";
const variants: Record<Variant, string> = {
  primary: "bg-route text-route-ink hover:brightness-110",
  secondary: "border border-line-strong bg-surface text-ink hover:border-route",
  ghost: "text-route hover:bg-route-soft",
  danger: "border border-alert/50 bg-surface text-alert hover:bg-alert-soft",
};

export const buttonClass = (variant: Variant = "primary", extra = "") => `${base} ${variants[variant]} ${extra}`;

export function Button({ variant = "primary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, className)} {...props}>
      {pending ? (pendingText ?? "Guardando…") : children}
    </button>
  );
}

export function LinkButton({ variant = "primary", className = "", ...props }: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}
