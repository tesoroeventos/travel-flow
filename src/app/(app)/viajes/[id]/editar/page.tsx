import { getTripData } from "@/server/queries";
import { quickValues } from "@/server/services/quick-trip";
import { QuickTripForm } from "@/ui/QuickTripForm";

export const metadata = { title: "Datos del viaje · TravelFlow" };

export default async function EditTripPage({
  params,
}: PageProps<"/viajes/[id]/editar">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 md:px-0">
      <h2 className="font-display text-3xl font-bold">Datos del viaje</h2>
      <QuickTripForm
        tripId={id}
        defaults={quickValues(data.trip, data.travelers.length)}
      />
    </main>
  );
}
