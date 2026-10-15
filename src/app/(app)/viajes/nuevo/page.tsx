import { createTripAction } from "@/server/actions/trips";
import { TripWizard } from "@/ui/TripWizard";

export const metadata = { title: "Crear viaje · TravelFlow" };

export default function NewTripPage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-6 md:px-0">
      <h1 className="font-display text-4xl font-bold tracking-tight">Crear viaje</h1>
      <TripWizard action={createTripAction} submitLabel="Crear viaje" />
    </main>
  );
}
