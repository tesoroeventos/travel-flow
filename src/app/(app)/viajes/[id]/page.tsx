import { redirect } from "next/navigation";
import { getTripData } from "@/server/queries";

/** El viaje abre en Opciones mientras se planifica, y en el Itinerario cuando ya hay una opción elegida. */
export default async function TripPage({ params }: PageProps<"/viajes/[id]">) {
  const { id } = await params;
  const { data } = await getTripData(id);
  redirect(`/viajes/${id}/${data.trip.chosenScenarioId ? "itinerario" : "opciones"}`);
}
