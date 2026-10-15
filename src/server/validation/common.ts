import Decimal from "decimal.js";
import { z } from "zod";
import { parseAmount } from "@/domain/money/parse";
import { SUPPORTED_CURRENCIES } from "@/domain/money/money";

export const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const LATAM_DECIMAL = /^(\d{1,3}(\.\d{3})+|\d+)(,\d+)?$/;

export const text = (message: string) => z.string().trim().min(1, message);
export const optText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));

export const dateField = z.string().regex(DATE_RE, "Fecha inválida");
export const timeField = z.string().regex(TIME_RE, "Hora inválida (HH:MM)");
export const optTime = z
  .union([z.literal(""), z.string().regex(TIME_RE, "Hora inválida (HH:MM)")])
  .optional()
  .transform((v) => (v ? v : null));
export const optDate = z
  .union([z.literal(""), z.string().regex(DATE_RE, "Fecha inválida")])
  .optional()
  .transform((v) => (v ? v : null));

export const tzField = z.string().trim().min(1).default(DEFAULT_TZ);
export const currencyField = z.enum(SUPPORTED_CURRENCIES, { message: "Moneda no soportada" });
export const uuidField = z.uuid("Identificador inválido");

export const intField = (min: number, message: string) => z.coerce.number().int(message).min(min, message);

/** Número opcional: vacío → null. Acepta coma decimal. */
export const optNumber = z
  .union([z.number(), z.string()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(v.replace(",", "."));
    if (Number.isNaN(n)) {
      ctx.addIssue({ code: "custom", message: "Número inválido" });
      return z.NEVER;
    }
    return n;
  });
export const optInt = optNumber.refine((n) => n === null || Number.isInteger(n), "Debe ser un número entero");

export const boolField = z
  .union([z.boolean(), z.enum(["on", "true", "false", ""])])
  .optional()
  .transform((v) => v === true || v === "on" || v === "true");

/** Importe en formato latinoamericano → centavos. */
export const amountField = z.string().transform((s, ctx) => {
  const r = parseAmount(s);
  if (!r.ok) {
    ctx.addIssue({ code: "custom", message: r.error.message });
    return z.NEVER;
  }
  return r.data;
});

/** Decimal positivo en formato latinoamericano (1.000,50) → string decimal ("1000.5"). */
export const positiveDecimal = (message: string) =>
  z.union([z.string(), z.number()]).transform((v, ctx) => {
    const s = String(v).trim();
    if (typeof v === "string" && !LATAM_DECIMAL.test(s)) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    const d = new Decimal(typeof v === "number" ? v : s.replace(/\./g, "").replace(",", "."));
    if (d.lte(0)) {
      ctx.addIssue({ code: "custom", message });
      return z.NEVER;
    }
    return d.toString();
  });
