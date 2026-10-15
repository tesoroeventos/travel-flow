import { Brand } from "@/ui/Brand";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <Brand size="lg" />
        <p className="mt-4 text-lg text-ink-soft">
          Contá tu viaje en una frase, subí capturas de vuelos y hoteles, y te
          armamos las 3 mejores opciones con el costo real.
        </p>
      </div>
      {children}
    </main>
  );
}
