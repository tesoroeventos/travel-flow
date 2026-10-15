import { describe, expect, it } from "vitest";
import { computeScenarioCosts } from "./engine";
import { barilocheScenarioA } from "../__fixtures__/bariloche";
import type { CostItemInput, ScenarioCostInput } from "./types";

function single(item: Partial<CostItemInput>, over: Partial<ScenarioCostInput> = {}): ScenarioCostInput {
  const base = barilocheScenarioA();
  return {
    ...base,
    ...over,
    items: [{ ...base.items[0]!, id: "x", certainty: "estimated", paymentStatus: "payment_pending", ...item }],
  };
}

describe("computeScenarioCosts — caso Bariloche A calculado a mano", () => {
  const s = computeScenarioCosts(barilocheScenarioA());

  it("totales", () => {
    expect(s.totalCents).toBe(125503000);
    expect(s.contingencyCents).toBe(2550000);
    expect(s.totalWithContingencyCents).toBe(128053000);
    expect(s.deviationCents).toBe(-21947000);
  });
  it("por persona y por día por persona", () => {
    expect(s.perPersonCents).toBe(62751500);
    expect(s.perPersonPerDayCents).toBe(8964500);
  });
  it("retenido, confirmado/estimado, pagado/pendiente", () => {
    expect(s.refundableHeldCents).toBe(5000000);
    expect(s.confirmedCents).toBe(24000000);
    expect(s.estimatedCents).toBe(101503000);
    expect(s.paidCents).toBe(24000000);
    expect(s.pendingCents).toBe(101503000);
  });
  it("por categoría y por tipo", () => {
    expect(s.byCategory.lodging).toBe(48000000);
    expect(s.byCategory.insurance).toBe(6003000);
    expect(s.byCategory.food).toBe(17500000);
    expect(s.byCostType.optional).toBe(8000000);
  });
  it("completo y sin advertencias", () => {
    expect(s.incomplete).toBe(false);
    expect(s.warnings).toEqual([]);
  });
  it("línea del seguro muestra original, multiplicador y convertido", () => {
    const line = s.lines.find((l) => l.itemId === "insurance");
    expect(line).toMatchObject({
      multiplier: "2",
      originalCents: 6000,
      originalCurrency: "USD",
      convertedCents: 6003000,
      status: "counted",
    });
  });
});

describe("computeScenarioCosts — casos borde", () => {
  it("sin tasa: el seguro queda fuera y el total es incompleto", () => {
    const s = computeScenarioCosts({ ...barilocheScenarioA(), rates: [] });
    expect(s.lines.find((l) => l.itemId === "insurance")?.status).toBe("missing_rate");
    expect(s.totalCents).toBe(119500000);
    expect(s.incomplete).toBe(true);
    expect(s.warnings).toContainEqual({ code: "missing_exchange_rate", itemId: "insurance", detail: "USD→ARS" });
  });

  it("per_person_night multiplica viajeros por noches", () => {
    const s = computeScenarioCosts(single({ unit: "per_person_night", nights: 3, amountCents: 100 }));
    expect(s.lines[0]?.multiplier).toBe("6");
    expect(s.totalCents).toBe(600);
  });

  it("per_night sin noches usa días del viaje − 1", () => {
    const s = computeScenarioCosts(single({ unit: "per_night", nights: null, amountCents: 100 }));
    expect(s.totalCents).toBe(600);
  });

  it("cantidad decimal redondea half-even", () => {
    const s = computeScenarioCosts(single({ unit: "total", amountCents: 101, quantity: "0.5" }));
    expect(s.lines[0]?.convertedCents).toBe(50);
  });

  it("precio consultado hace 15 días es viejo; 14 no", () => {
    const old = computeScenarioCosts(single({ consultedAt: "2026-12-21" }));
    const ok = computeScenarioCosts(single({ consultedAt: "2026-12-22" }));
    expect(old.warnings).toContainEqual({ code: "stale_price", itemId: "x", detail: "15" });
    expect(ok.warnings.find((w) => w.code === "stale_price")).toBeUndefined();
  });

  it("impuestos desconocidos generan aviso", () => {
    const s = computeScenarioCosts(single({ includesTaxes: null }));
    expect(s.warnings).toContainEqual({ code: "unknown_taxes", itemId: "x" });
  });

  it("cobertura incompleta genera avisos", () => {
    const s = computeScenarioCosts({
      ...barilocheScenarioA(),
      coverage: { hasOutbound: false, hasReturn: true, uncoveredNights: 2 },
    });
    expect(s.warnings).toContainEqual({ code: "missing_outbound_transport" });
    expect(s.warnings).toContainEqual({ code: "uncovered_nights", detail: "2" });
  });

  it("cero viajeros no divide por cero", () => {
    const s = computeScenarioCosts({ ...barilocheScenarioA(), travelers: 0 });
    expect(s.perPersonCents).toBeNull();
    expect(s.perPersonPerDayCents).toBeNull();
  });
});
