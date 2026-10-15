import { QuickTripForm } from "@/ui/QuickTripForm";

export const metadata = { title: "Viaje nuevo · TravelFlow" };

export default function NewTripPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-6 md:px-0">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-5xl font-extrabold tracking-tight">
          ¿A dónde vas?
        </h1>
        <p className="text-lg text-ink-soft">
          Contalo como se lo dirías a un amigo. TravelFlow arma el viaje y vos
          solo corregís lo que haga falta.
        </p>
      </div>
      <QuickTripForm />
    </main>
  );
}
