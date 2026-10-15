import type { z } from "zod";

/** Estado de un formulario manejado por una acción del servidor. */
export interface FormState {
  ok?: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

export function formValues(fd: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (typeof v === "string" && !(k in out)) out[k] = v;
  return out;
}

/** Convierte FormData en objeto, agrupando campos repetidos (checkboxes) en arreglos. */
export function formObject(fd: FormData, arrayFields: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$")) continue;
    const all = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = arrayFields.includes(key) ? all : all[0];
  }
  for (const k of arrayFields) out[k] ??= [];
  return out;
}

export function zodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "_";
    out[key] ??= issue.message;
  }
  return out;
}

export function invalid(error: z.ZodError, fd: FormData): FormState {
  return { ok: false, message: "Revisá los campos marcados", fieldErrors: zodErrors(error), values: formValues(fd) };
}
