"use client";

import { COST_UNIT_LABELS, type CostUnit } from "@/domain/costs/types";
import { Field, SelectField } from "./Field";
import { CURRENCY_OPTIONS } from "./options";

/** Precio principal al crear una alternativa (se guarda como su primera partida). */
export function QuickPrice({ baseCurrency, defaultUnit, error }: { baseCurrency: string; defaultUnit: CostUnit; error?: string }) {
  return (
    <div className="rounded-md border border-line p-3">
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <Field label="Precio" name="price" inputMode="decimal" placeholder="Opcional" error={error} />
        <SelectField label="Moneda" name="priceCurrency" options={CURRENCY_OPTIONS} defaultValue={baseCurrency} />
      </div>
      <SelectField
        className="mt-2"
        label="Se cobra"
        name="priceUnit"
        options={(Object.keys(COST_UNIT_LABELS) as CostUnit[]).map((u) => ({ value: u, label: COST_UNIT_LABELS[u] }))}
        defaultValue={defaultUnit}
      />
      <p className="mt-2 text-sm text-ink-soft">Después podés sumar impuestos, equipaje, traslados y otros costos como partidas.</p>
    </div>
  );
}
