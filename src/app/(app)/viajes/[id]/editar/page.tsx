import { getTripData } from "@/server/queries";
import { updateTripAction } from "@/server/actions/trips";
import { localDate, localTime } from "@/domain/time/calendar";
import { TripWizard, type WizardDefaults } from "@/ui/TripWizard";
import { fmtAmount } from "@/ui/format";

export const metadata = { title: "Editar viaje · TravelFlow" };

export default async function EditTripPage({ params }: PageProps<"/viajes/[id]/editar">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  const { trip, travelers } = data;
  const s = trip.startAt.toISOString();
  const e = trip.endAt.toISOString();
  const str = (v: unknown) => (v === null || v === undefined ? undefined : String(v));
  const prefs = trip.preferences as Record<string, unknown>;
  const cons = trip.constraints as Record<string, unknown>;

  const defaults: WizardDefaults = {
    name: trip.name,
    originLabel: trip.originLabel,
    homeLabel: trip.homeLabel ?? undefined,
    destinationLabel: trip.destinationLabel,
    alternativeDestinations: trip.alternativeDestinations.join(", "),
    stops: data.stops.map((x) => x.label),
    startDate: localDate(s, trip.startTz),
    startTime: localTime(s, trip.startTz),
    endDate: localDate(e, trip.endTz),
    endTime: localTime(e, trip.endTz),
    tz: trip.startTz,
    endTz: trip.endTz,
    flexibilityDays: String(trip.flexibilityDays),
    adults: String(travelers.filter((t) => t.kind === "adult").length),
    children: String(travelers.filter((t) => t.kind === "child").length),
    infants: String(travelers.filter((t) => t.kind === "infant").length),
    rooms: String(trip.rooms),
    tripType: trip.tripType,
    budget: fmtAmount(trip.budgetCents),
    baseCurrency: trip.baseCurrency,
    ...Object.fromEntries(Object.entries(prefs).map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : str(v)])),
    ...Object.fromEntries(Object.entries(cons).map(([k, v]) => [k, typeof v === "boolean" ? v : str(v)])),
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-0">
      <h2 className="font-display text-3xl font-semibold">Editar datos del viaje</h2>
      <TripWizard action={updateTripAction.bind(null, id)} defaults={defaults} submitLabel="Guardar cambios" />
    </main>
  );
}
