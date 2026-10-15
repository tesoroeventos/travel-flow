"use client";

import { useActionState, useEffect, useState } from "react";
import { CATEGORY_LABELS, COST_CATEGORIES, COST_UNIT_LABELS, type CostCategory, type CostUnit } from "@/domain/costs/types";
import { deleteCostItemAction, saveCostItemAction } from "@/server/actions/options";
import type { FormState } from "@/server/actions/form";
import { CheckField, Field, SelectField } from "./Field";
import { Button, SubmitButton } from "./Button";
import { ConfirmButton } from "./ConfirmButton";
import { CURRENCY_OPTIONS } from "./options";
import { fmtAmount, fmtDate, fmtMoney } from "./format";

export interface CostItemView {
  id: string;
  label: string;
  amountCents: number;
  currency: string;
  unit: CostUnit;
  quantity: string;
  category: CostCategory;
  costType: "fixed" | "variable" | "optional";
  refundable: boolean;
  source: string | null;
  consultedAt: string | null;
  includesTaxes: boolean | null;
  certainty: "estimated" | "confirmed";
  isDemo: boolean;
  multiplier: string | null;
  lineCents: number | null;
  lineStatus: "counted" | "refundable" | "missing_rate" | null;
  assumptions: Record<string, string> | null;
}

type Owner = { ownerType: "transport_option" | "lodging_option" | "activity" | "scenario"; ownerId: string };

const UNIT_OPTIONS = (Object.keys(COST_UNIT_LABELS) as CostUnit[]).map((u) => ({ value: u, label: COST_UNIT_LABELS[u] }));
const CATEGORY_OPTIONS = COST_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] }));

function CostItemForm({
  tripId,
  owner,
  item,
  baseCurrency,
  defaultCategory,
  onDone,
}: {
  tripId: string;
  owner: Owner | null;
  item: CostItemView | null;
  baseCurrency: string;
  defaultCategory: CostCategory;
  onDone: () => void;
}) {
  const [state, action] = useActionState<FormState, FormData>(saveCostItemAction.bind(null, tripId, owner, item?.id ?? null), {});
  useEffect(() => {
    if (state.ok) onDone();
  }, [state, onDone]);
  const v = (k: string, d?: string) => state.values?.[k] ?? d;
  const e = state.fieldErrors ?? {};
  const today = new Date().toISOString().slice(0, 10);
  return (
    <form action={action} aria-label={item ? `Editar ${item.label}` : "Nueva partida"} className="mt-2 space-y-3 rounded-md border border-line bg-surface-2 p-3">
      <Field label="Descripción" name="label" required defaultValue={v("label", item?.label)} error={e.label} />
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <Field label="Importe" name="amount" required inputMode="decimal" defaultValue={v("amount", item ? fmtAmount(item.amountCents) : undefined)} error={e.amount} />
        <SelectField label="Moneda" name="currency" options={CURRENCY_OPTIONS} defaultValue={v("currency", item?.currency ?? baseCurrency)} />
      </div>
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <SelectField label="Se cobra" name="unit" options={UNIT_OPTIONS} defaultValue={v("unit", item?.unit ?? "total")} />
        <Field label="Cantidad" name="quantity" inputMode="decimal" defaultValue={v("quantity", item ? item.quantity.replace(/\.?0+$/, "").replace(".", ",") : "1")} error={e.quantity} />
      </div>
      <SelectField label="Categoría" name="category" options={CATEGORY_OPTIONS} defaultValue={v("category", item?.category ?? defaultCategory)} />
      <div className="grid grid-cols-2 gap-2">
        <SelectField
          label="Tipo de gasto"
          name="costType"
          options={[
            { value: "fixed", label: "Fijo" },
            { value: "variable", label: "Variable" },
            { value: "optional", label: "Opcional" },
          ]}
          defaultValue={v("costType", item?.costType ?? "fixed")}
        />
        <SelectField
          label="Certeza"
          name="certainty"
          options={[
            { value: "estimated", label: "Estimado" },
            { value: "confirmed", label: "Confirmado" },
          ]}
          defaultValue={v("certainty", item?.certainty ?? "estimated")}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Fuente" name="source" defaultValue={v("source", item?.source ?? "Carga manual")} />
        <Field label="Consultado el" name="consultedAt" type="date" defaultValue={v("consultedAt", item?.consultedAt ?? today)} />
      </div>
      <SelectField
        label="¿Incluye impuestos?"
        name="includesTaxes"
        options={[
          { value: "unknown", label: "No sé" },
          { value: "yes", label: "Sí" },
          { value: "no", label: "No" },
        ]}
        defaultValue={v("includesTaxes", item ? (item.includesTaxes === null ? "unknown" : item.includesTaxes ? "yes" : "no") : "yes")}
      />
      <CheckField label="Reembolsable (depósito, no es gasto)" name="refundable" defaultChecked={item?.refundable} />
      <div className="flex gap-2">
        <SubmitButton>Guardar partida</SubmitButton>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "ok" | "signal" | "alert" }) {
  const tones = {
    neutral: "bg-surface-2 text-ink-soft",
    ok: "bg-route-soft text-ink",
    signal: "bg-signal-soft text-ink",
    alert: "bg-alert-soft text-ink",
  };
  return <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export function CostItemsEditor({
  tripId,
  owner,
  items,
  baseCurrency,
  defaultCategory,
  readOnly = false,
}: {
  tripId: string;
  owner: Owner;
  items: CostItemView[];
  baseCurrency: string;
  defaultCategory: CostCategory;
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <div>
      <ul className="divide-y divide-line">
        {items.map((i) => (
          <li key={i.id} className="py-2">
            {editing === i.id ? (
              <CostItemForm tripId={tripId} owner={null} item={i} baseCurrency={baseCurrency} defaultCategory={defaultCategory} onDone={() => setEditing(null)} />
            ) : (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{i.label}</p>
                  <p className="num text-sm text-ink-soft">
                    {fmtMoney(i.amountCents, i.currency)} {COST_UNIT_LABELS[i.unit].toLowerCase()}
                    {i.multiplier && i.multiplier !== "1" && i.unit !== "total" ? ` × ${i.multiplier}` : ""}
                    {i.quantity !== "1" && !/^1\.0+$/.test(i.quantity) ? ` × ${i.quantity.replace(/\.?0+$/, "").replace(".", ",")}` : ""}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge tone={i.certainty === "confirmed" ? "ok" : "neutral"}>{i.certainty === "confirmed" ? "Confirmado" : "Estimado"}</Badge>
                    {i.isDemo ? <Badge tone="signal">Dato de demostración</Badge> : i.source ? <Badge>{i.source}{i.consultedAt ? `, ${fmtDate(i.consultedAt)}` : ""}</Badge> : null}
                    {i.costType === "optional" ? <Badge>Opcional</Badge> : i.costType === "variable" ? <Badge>Variable</Badge> : null}
                    {i.refundable ? <Badge tone="signal">Reembolsable</Badge> : null}
                    {i.includesTaxes === null ? <Badge tone="signal">Impuestos sin confirmar</Badge> : i.includesTaxes === false ? <Badge>Sin impuestos</Badge> : null}
                    {i.lineStatus === "missing_rate" ? <Badge tone="alert">Falta tipo de cambio {i.currency}→{baseCurrency}</Badge> : null}
                  </div>
                </div>
                <div className="text-right">
                  <p className="num font-semibold">{i.lineCents === null ? "—" : fmtMoney(i.lineCents, baseCurrency)}</p>
                  {!readOnly ? (
                    <div className="mt-1 flex justify-end gap-1">
                      <button type="button" className="min-h-9 px-1 text-sm font-semibold text-route" aria-label={`Editar partida ${i.label}`} onClick={() => setEditing(i.id)}>
                        Editar
                      </button>
                      <ConfirmButton variant="ghost" className="!min-h-9 !px-1 !text-sm !text-alert" action={deleteCostItemAction.bind(null, tripId, i.id)} label="Quitar" confirm={`¿Quitar "${i.label}"?`} />
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {!readOnly ? (
        editing === "new" ? (
          <CostItemForm tripId={tripId} owner={owner} item={null} baseCurrency={baseCurrency} defaultCategory={defaultCategory} onDone={() => setEditing(null)} />
        ) : (
          <button type="button" className="mt-1 min-h-11 font-semibold text-route" onClick={() => setEditing("new")}>
            Agregar partida
          </button>
        )
      ) : null}
    </div>
  );
}
