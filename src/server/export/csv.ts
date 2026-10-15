import { CATEGORY_LABELS, type CostItemInput, type CostSummary } from "@/domain/costs/types";
import { fmtAmount } from "@/ui/format";

const STATUS = { counted: "Contado", refundable: "Retenido", missing_rate: "Sin tipo de cambio" } as const;

function cell(v: string | number | null | undefined): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const row = (values: (string | number | null | undefined)[]) => values.map(cell).join(";");

/** Presupuesto de un escenario en CSV (separador ";", BOM UTF-8, importes con formato 1.234,56). */
export function budgetCsv(
  scenario: { name: string; summary: CostSummary; baseCurrency: string },
  items: (CostItemInput & { source: string | null })[],
): string {
  const { summary: s, baseCurrency: base } = scenario;
  const lines = new Map(s.lines.map((l) => [l.itemId, l]));
  const out = [
    row(["Partida", "Categoría", "Importe original", "Moneda", "Multiplicador", "Importe convertido", "Moneda base", "Estado", "Certeza", "Fuente", "Fecha de consulta"]),
  ];
  for (const i of items) {
    const l = lines.get(i.id);
    out.push(
      row([
        i.label,
        CATEGORY_LABELS[i.category],
        fmtAmount(i.amountCents),
        i.currency,
        l?.multiplier.replace(".", ",") ?? "",
        l?.convertedCents === null || l?.convertedCents === undefined ? "" : fmtAmount(l.convertedCents),
        base,
        l ? STATUS[l.status] : "",
        i.certainty === "confirmed" ? "Confirmado" : "Estimado",
        i.source,
        i.consultedAt,
      ]),
    );
  }
  out.push("");
  const total = (label: string, cents: number | null) => row([label, "", "", "", "", cents === null ? "" : fmtAmount(cents), base]);
  out.push(total("Total", s.totalCents));
  out.push(total("Imprevistos", s.contingencyCents));
  out.push(total("Total con imprevistos", s.totalWithContingencyCents));
  out.push(total("Por persona", s.perPersonCents));
  out.push(total("Por día y persona", s.perPersonPerDayCents));
  out.push(total("Desvío", s.deviationCents));
  out.push(total("Retenido en depósitos", s.refundableHeldCents));
  if (s.incomplete) out.push(row(["Atención: total incompleto, falta algún tipo de cambio"]));
  return `﻿${out.join("\r\n")}\r\n`;
}
