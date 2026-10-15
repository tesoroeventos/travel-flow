"use client";

import { useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const control =
  "w-full min-h-12 rounded-xl border-[1.5px] border-line bg-surface-2 px-3 py-2.5 text-base text-ink placeholder:text-ink-soft/70 focus:border-route focus:outline-none focus:ring-2 focus:ring-route/25 disabled:opacity-60";

interface FieldShell {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
}

function Shell({ id, label, error, hint, className, children }: Omit<FieldShell, "name"> & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-bold tracking-wider text-ink-soft uppercase">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-alert" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1 text-sm text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

export function Field({
  label,
  name,
  error,
  hint,
  className,
  ...input
}: FieldShell & Omit<InputHTMLAttributes<HTMLInputElement>, "name">) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={control}
        {...input}
      />
    </Shell>
  );
}

export function SelectField({
  label,
  name,
  error,
  hint,
  className,
  options,
  ...select
}: FieldShell & Omit<SelectHTMLAttributes<HTMLSelectElement>, "name"> & { options: { value: string; label: string }[] }) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <select id={id} name={name} aria-invalid={error ? true : undefined} className={control} {...select}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

export function TextAreaField({
  label,
  name,
  error,
  hint,
  className,
  ...ta
}: FieldShell & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const id = useId();
  return (
    <Shell id={id} label={label} error={error} hint={hint} className={className}>
      <textarea id={id} name={name} rows={3} className={control} {...ta} />
    </Shell>
  );
}

export function CheckField({ label, name, defaultChecked, value }: { label: string; name: string; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-base">
      <input type="checkbox" name={name} value={value ?? "on"} defaultChecked={defaultChecked} className="size-5 accent-route" />
      {label}
    </label>
  );
}
