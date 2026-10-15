import Link from "next/link";
import type { TripCard } from "@/server/services/dashboard";
import { fmtMoney, fmtRange, plural } from "./format";

function Bar({ value, max, tone }: { value: number; max: number; tone: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function TripCardView({ card }: { card: TripCard }) {
  const over = card.estimatedCents !== null && card.estimatedCents > card.budgetCents;
  const max = Math.max(card.budgetCents, card.estimatedCents ?? 0, card.actualCents);
  return (
    <Link
      href={`/viajes/${card.id}`}
      className="block rounded-2xl bg-surface shadow-card p-4 hover:border-route focus-visible:border-route"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-xl font-semibold leading-tight">{card.name}</h3>
        {card.isDemo ? <span className="shrink-0 rounded bg-signal-soft px-2 py-0.5 text-xs font-semibold">Demo</span> : null}
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <span className="font-medium">{card.originLabel}</span>
        <div className="route-line min-w-8 flex-1" aria-hidden />
        <span className="font-medium">{card.destinationLabel}</span>
      </div>
      <p className="mt-2 text-sm text-ink-soft">
        {fmtRange(card.startDate, card.endDate)}, {plural(card.days, "día", "días")}, {plural(card.travelers, "viajero", "viajeros")}
      </p>
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Presupuesto</dt>
            <dd className="num font-medium">{fmtMoney(card.budgetCents, card.baseCurrency)}</dd>
          </div>
        </div>
        <div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">
              {card.estimateSource === "chosen" ? "Estimado (escenario elegido)" : card.estimateSource === "cheapest" ? "Estimado (más económico)" : "Estimado"}
            </dt>
            <dd className={`num font-medium ${over ? "text-alert" : ""}`}>
              {card.estimatedCents === null ? "Sin escenarios" : fmtMoney(card.estimatedCents, card.baseCurrency)}
              {card.estimateIncomplete ? " *" : ""}
            </dd>
          </div>
          {card.estimatedCents !== null ? <Bar value={card.estimatedCents} max={max} tone={over ? "bg-alert" : "bg-route"} /> : null}
        </div>
        <div>
          <div className="flex justify-between">
            <dt className="text-ink-soft">Gastado</dt>
            <dd className="num font-medium">
              {fmtMoney(card.actualCents, card.baseCurrency)}
              {card.actualIncomplete ? " *" : ""}
            </dd>
          </div>
          <Bar value={card.actualCents} max={max} tone="bg-signal" />
        </div>
      </dl>
      {card.estimateIncomplete || card.actualIncomplete ? (
        <p className="mt-2 text-xs text-ink-soft">* Falta algún tipo de cambio: el importe está incompleto.</p>
      ) : null}
    </Link>
  );
}
