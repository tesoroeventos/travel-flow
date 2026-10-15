import { getTripData } from "@/server/queries";
import { localDate, tripDays } from "@/domain/time/calendar";
import { TripTabs } from "@/ui/TripTabs";
import { RouteStrip } from "@/ui/RouteStrip";
import { DemoBanner } from "@/ui/Feedback";
import { fmtRange, plural } from "@/ui/format";

export default async function TripLayout({ children, params }: LayoutProps<"/viajes/[id]">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const { trip, travelers } = data;
  const start = localDate(trip.startAt.toISOString(), trip.startTz);
  const end = localDate(trip.endAt.toISOString(), trip.endTz);
  const days = tripDays(trip.startAt.toISOString(), trip.startTz, trip.endAt.toISOString(), trip.endTz);

  return (
    <div>
      {trip.isDemo ? <DemoBanner /> : null}
      <header className="px-4 pt-6 md:px-0">
        <h1 className="font-display text-4xl font-bold leading-none tracking-tight">{trip.name}</h1>
        <RouteStrip points={[trip.originLabel, ...data.stops.map((s) => s.label), trip.destinationLabel]} />
        <p className="mt-3 text-ink-soft">
          {fmtRange(start, end)}, {plural(days, "día", "días")}, {plural(travelers.length, "viajero", "viajeros")}
        </p>
      </header>
      <div className="mt-4 px-4 md:px-0">
        <TripTabs base={`/viajes/${id}`} />
      </div>
      {children}
    </div>
  );
}
