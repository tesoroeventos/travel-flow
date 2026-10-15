import Link from "next/link";
import { getTripData } from "@/server/queries";
import { proposalsFromLoaded } from "@/server/services/proposals";
import type { LoadedTrip } from "@/server/services/load-trip";
import { fmtMoney, plural } from "@/ui/format";
import type { IconName } from "@/ui/icons";
import { Note } from "@/ui/Note";
import { fmtTravel, ProposalCard } from "@/ui/proposals/ProposalCard";
import { parseSwaps } from "@/ui/proposals/swaps";
import { daysDiff, localDate } from "@/domain/time/calendar";

export const metadata = { title: "Tus 3 opciones · TravelFlow" };

const MODE: Record<string, string> = {
  flight: "Vuelo",
  bus: "Micro",
  train: "Tren",
  own_car: "Tu auto",
  rental_car: "Auto de alquiler",
};
const ICON: Record<string, IconName> = {
  flight: "plane",
  bus: "bus",
  train: "train",
  own_car: "car",
  rental_car: "key",
};

function legName(data: LoadedTrip, id: string): string {
  const t = data.transport.find((x) => x.id === id)!;
  if (t.mode === "own_car") return "Tu auto";
  return `${MODE[t.mode] ?? "Transporte"} ${t.leg === "outbound" ? "ida" : "vuelta"}${t.provider ? ` ${t.provider}` : ""}`;
}

export default async function ProposalsPage({ params, searchParams }: PageProps<"/viajes/[id]/propuestas">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const res = proposalsFromLoaded(data, {
    swaps: parseSwaps(await searchParams),
  });
  const cur = data.trip.baseCurrency;
  const missing = [...res.missing, ...(res.needsUsdRate ? ["a cuánto tomás el dólar"] : [])];

  if (missing.length || !res.cards.length) {
    return (
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 py-6 md:px-0">
        <h2 className="font-display text-3xl font-bold">Tus 3 opciones</h2>
        <Note tone="warn">
          Para comparar falta {missing.length ? missing.join(", ") : "al menos una combinación con precio"}.
        </Note>
        <Link
          href={`/viajes/${id}/opciones`}
          className="inline-flex min-h-12 items-center self-start rounded-xl bg-route px-5 font-bold text-route-ink"
        >
          Ir a Opciones
        </Link>
      </main>
    );
  }

  const planLabels = res.plans.map((p) =>
    p.length === 2 && p[0]!.pairId
      ? legName(data, p[0]!.id) + " (ida y vuelta)"
      : p.map((l) => legName(data, l.id)).join(" + "),
  );
  const lodgingLabels = res.lodgings.map((l) => l.name);
  const icons: Record<string, IconName> = Object.fromEntries([
    ...data.transport.map((t) => [t.id, ICON[t.mode] ?? "ticket"] as const),
    ...data.lodging.map((l) => [l.id, "bed"] as const),
    ...data.activities.map((a) => [a.id, "ticket"] as const),
  ]);
  const planIndex = (legIds: string[]) => res.plans.findIndex((p) => p.map((l) => l.id).join("+") === legIds.join("+"));
  const nights = daysDiff(
    localDate(data.trip.startAt.toISOString(), data.trip.startTz),
    localDate(data.trip.endAt.toISOString(), data.trip.endTz),
  );
  const all = res.all.filter((c) => c.costCents !== null).sort((a, b) => a.costCents! - b.costCents!);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-6 md:px-0">
      <div>
        <h2 className="font-display text-3xl font-bold">Tus 3 opciones para {data.trip.destinationLabel}</h2>
        <p className="text-ink-soft">
          {plural(res.comboCount, "combinación revisada", "combinaciones revisadas")} ·{" "}
          {plural(data.travelers.length, "persona", "personas")} · {plural(nights, "noche", "noches")}
        </p>
      </div>
      {res.cards.map((v) => (
        <ProposalCard
          key={v.tags.join("-")}
          tripId={id}
          view={v}
          currency={cur}
          icons={icons}
          planLabels={planLabels}
          lodgingLabels={lodgingLabels}
          planIndex={planIndex(v.combo.legIds)}
          lodgingIndex={res.lodgings.findIndex((l) => l.id === v.combo.lodgingId)}
        />
      ))}
      <details className="rounded-2xl bg-surface shadow-card">
        <summary className="cursor-pointer px-4.5 py-3.5 font-bold">Ver las {all.length} combinaciones</summary>
        <div className="overflow-x-auto px-2 pb-3">
          <table aria-label="Todas las combinaciones" className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="text-left text-xs tracking-wider text-ink-soft uppercase">
                <th className="px-2.5 py-2">Transporte</th>
                <th className="px-2.5 py-2">Alojamiento</th>
                <th className="px-2.5 py-2 text-right">Total</th>
                <th className="px-2.5 py-2 text-right">Viaje</th>
                <th className="px-2.5 py-2 text-right">Confort</th>
              </tr>
            </thead>
            <tbody>
              {all.map((c) => (
                <tr key={c.key} className="border-t border-line align-top">
                  <td className="px-2.5 py-2">{planLabels[planIndex(c.legIds)]}</td>
                  <td className="px-2.5 py-2">{lodgingLabels[res.lodgings.findIndex((l) => l.id === c.lodgingId)]}</td>
                  <td className="num px-2.5 py-2 text-right whitespace-nowrap">{fmtMoney(c.costCents!, cur)}</td>
                  <td className="num px-2.5 py-2 text-right whitespace-nowrap">{fmtTravel(c.minutes)}</td>
                  <td className="num px-2.5 py-2 text-right">
                    {(Math.round(c.comfort * 10) / 10).toLocaleString("es-AR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </main>
  );
}
