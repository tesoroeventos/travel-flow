import { err, ok, type Result } from "../result";

const WITH_THOUSANDS = /^\d{1,3}(\.\d{3})+(,\d+)?$/;
const PLAIN = /^\d+(,\d+)?$/;

/** Convierte un importe escrito en formato latinoamericano (1.234,56) a centavos. */
export function parseAmount(input: string): Result<number> {
  const s = input.trim();
  if (s === "") return err("empty", "Ingresá un importe");
  if (s.startsWith("-")) return err("negative", "El importe no puede ser negativo");
  if (!WITH_THOUSANDS.test(s) && !PLAIN.test(s)) {
    return err("invalid", "Formato inválido. Ejemplo: 1.234,56");
  }
  const [intPart = "0", decPart = ""] = s.replace(/\./g, "").split(",");
  if (decPart.length > 2) return err("too_many_decimals", "Usá como máximo 2 decimales");
  const cents = Number(intPart) * 100 + Number(decPart.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents)) return err("too_large", "El importe es demasiado grande");
  return ok(cents);
}
