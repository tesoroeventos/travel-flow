import { SUPPORTED_CURRENCIES } from "@/domain/money/money";

export const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((c) => ({ value: c, label: c }));

export const TZ_OPTIONS = [
  ["America/Argentina/Buenos_Aires", "Argentina"],
  ["America/Montevideo", "Uruguay"],
  ["America/Santiago", "Chile"],
  ["America/Sao_Paulo", "Brasil (Brasilia)"],
  ["America/Asuncion", "Paraguay"],
  ["America/La_Paz", "Bolivia"],
  ["America/Lima", "Perú"],
  ["America/Bogota", "Colombia"],
  ["America/Guayaquil", "Ecuador"],
  ["America/Caracas", "Venezuela"],
  ["America/Panama", "Panamá"],
  ["America/Costa_Rica", "Costa Rica"],
  ["America/Guatemala", "Guatemala"],
  ["America/Mexico_City", "México (centro)"],
  ["America/Santo_Domingo", "República Dominicana"],
  ["America/New_York", "Estados Unidos (este)"],
  ["Europe/Madrid", "España"],
  ["UTC", "UTC"],
].map(([value, label]) => ({ value: value!, label: label! }));
