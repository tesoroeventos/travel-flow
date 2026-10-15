"use client";

import { useActionState, useEffect } from "react";
import { CATEGORY_LABELS, COST_CATEGORIES } from "@/domain/costs/types";
import { saveExpenseAction } from "@/server/actions/expenses";
import type { FormState } from "@/server/actions/form";
import { CheckField, Field, SelectField } from "./Field";
import { Button, SubmitButton } from "./Button";
import { ErrorBanner } from "./Feedback";
import { CURRENCY_OPTIONS } from "./options";
import { useCloseDisclosure } from "./Disclosure";
import { fmtAmount } from "./format";

export interface ExpenseFormValues {
  id: string;
  date: string;
  category: string;
  description: string;
  amountCents: number;
  currency: string;
  paymentMethod: string | null;
  paidByTravelerId: string | null;
  participantIds: string[];
  paymentStatus: string;
  receiptUrl: string | null;
}

export function ExpenseForm({
  tripId,
  expense,
  travelers,
  baseCurrency,
  defaultDate,
}: {
  tripId: string;
  expense: ExpenseFormValues | null;
  travelers: { id: string; name: string }[];
  baseCurrency: string;
  defaultDate: string;
}) {
  const close = useCloseDisclosure();
  const [state, action] = useActionState<FormState, FormData>(saveExpenseAction.bind(null, tripId, expense?.id ?? null), {});
  useEffect(() => {
    if (state.ok) close();
  }, [state, close]);
  const v = (k: string, d?: string | null) => state.values?.[k] ?? d ?? undefined;
  const e = state.fieldErrors ?? {};
  return (
    <form action={action} aria-label={expense ? `Editar ${expense.description}` : "Nuevo gasto"} className="space-y-3 rounded-2xl bg-surface shadow-card p-4">
      {state.message ? <ErrorBanner>{state.message}</ErrorBanner> : null}
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fecha" name="date" type="date" required defaultValue={v("date", expense?.date ?? defaultDate)} error={e.date} />
        <SelectField label="Categoría" name="category" options={COST_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }))} defaultValue={v("category", expense?.category ?? "food")} />
      </div>
      <Field label="Descripción" name="description" required defaultValue={v("description", expense?.description)} error={e.description} />
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <Field label="Importe" name="amount" required inputMode="decimal" defaultValue={v("amount", expense ? fmtAmount(expense.amountCents) : undefined)} error={e.amount} />
        <SelectField label="Moneda" name="currency" options={CURRENCY_OPTIONS} defaultValue={v("currency", expense?.currency ?? baseCurrency)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Medio de pago" name="paymentMethod" defaultValue={v("paymentMethod", expense?.paymentMethod)} placeholder="Efectivo, tarjeta…" />
        <SelectField
          label="Pagó"
          name="paidByTravelerId"
          options={[{ value: "", label: "—" }, ...travelers.map((t) => ({ value: t.id, label: t.name }))]}
          defaultValue={v("paidByTravelerId", expense?.paidByTravelerId ?? "")}
        />
      </div>
      {travelers.length > 1 ? (
        <fieldset>
          <legend className="text-sm font-medium">Participantes del gasto</legend>
          <div className="grid grid-cols-2 gap-x-3">
            {travelers.map((t) => (
              <CheckField key={t.id} label={t.name} name="participantIds" value={t.id} defaultChecked={expense ? expense.participantIds.includes(t.id) : true} />
            ))}
          </div>
        </fieldset>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Estado de pago"
          name="paymentStatus"
          options={[
            { value: "paid", label: "Pagado" },
            { value: "payment_pending", label: "Pendiente" },
          ]}
          defaultValue={v("paymentStatus", expense?.paymentStatus ?? "paid")}
        />
        <Field label="Comprobante (enlace)" name="receiptUrl" type="url" defaultValue={v("receiptUrl", expense?.receiptUrl)} />
      </div>
      <div className="flex gap-2">
        <SubmitButton>Guardar gasto</SubmitButton>
        <Button type="button" variant="ghost" onClick={close}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
