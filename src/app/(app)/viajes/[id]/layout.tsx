import { getTripData } from "@/server/queries";
import { localDate } from "@/domain/time/calendar";
import { daysDiff } from "@/domain/time/calendar";
import { TripTabs } from "@/ui/TripTabs";
import { DemoBanner } from "@/ui/Feedback";
import { fmtMoney, fmtRange, plural } from "@/ui/format";

export default async function TripLayout({
  children,
  params,
}: LayoutProps<"/viajes/[id]">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const { trip, travelers } = data;
  const start = localDate(trip.startAt.toISOString(), trip.startTz);
  const end = localDate(trip.endAt.toISOString(), trip.endTz);
  const nights = Math.max(0, daysDiff(start, end));
  const chip =
    "inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold";

  return (
    <div>
      {trip.isDemo ? <DemoBanner /> : null}
      <header className="px-4 pt-6 md:px-0">
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight">
          {trip.destinationLabel || trip.name}
        </h1>
        <ul
          className="mt-3 flex flex-wrap gap-1.5"
          aria-label="Datos del viaje"
        >
          <li className={chip}>
            {trip.originLabel ? (
              `desde ${trip.originLabel}`
            ) : (
              <span className="text-signal">falta desde dónde salís</span>
            )}
          </li>
          <li className={chip}>
            {fmtRange(start, end)} · {plural(nights, "noche", "noches")}
          </li>
          <li className={chip}>
            {plural(travelers.length, "persona", "personas")}
          </li>
          {trip.budgetCents > 0 ? (
            <li className={chip}>
              presupuesto {fmtMoney(trip.budgetCents, trip.baseCurrency)}
            </li>
          ) : null}
        </ul>
      </header>
      <div className="mt-4 px-4 md:px-0">
        <TripTabs base={`/viajes/${id}`} />
      </div>
      {children}
    </div>
  );
}
