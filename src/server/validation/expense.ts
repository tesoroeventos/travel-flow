import { z } from "zod";
import { COST_CATEGORIES } from "@/domain/costs/types";
import { amountField, currencyField, dateField, optText, text } from "./common";

export const expenseSchema = z
  .object({
    date: dateField,
    category: z.enum(COST_CATEGORIES),
    description: text("Ingresá una descripción"),
    amount: amountField,
    currency: currencyField,
    paymentMethod: optText,
    paidByTravelerId: z
      .union([z.literal(""), z.uuid()])
      .optional()
      .transform((v) => (v ? v : null)),
    participantIds: z
      .union([z.array(z.uuid()), z.uuid()])
      .optional()
      .transform((v) => (v === undefined ? [] : Array.isArray(v) ? v : [v])),
    paymentStatus: z.enum(["payment_pending", "paid"]).default("paid"),
    receiptUrl: optText,
  })
  .transform(({ amount, ...rest }) => ({ ...rest, amountCents: amount }));
