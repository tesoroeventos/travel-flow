import { z } from "zod";
import { currencyField, dateField, positiveDecimal, text } from "./common";

export const exchangeRateSchema = z
  .object({
    fromCurrency: currencyField,
    toCurrency: currencyField,
    rate: positiveDecimal("Ingresá una tasa mayor a 0. Ejemplo: 1.000,50"),
    asOf: dateField,
    source: text("Indicá la fuente de la tasa"),
  })
  .refine((d) => d.fromCurrency !== d.toCurrency, { message: "Elegí dos monedas distintas", path: ["toCurrency"] });
