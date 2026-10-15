export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8">
        <p className="font-display text-4xl font-bold tracking-tight text-route">TravelFlow</p>
        <div className="route-line mt-3 w-24" aria-hidden />
        <p className="mt-4 text-ink-soft">Compará alternativas, calculá el costo real y armá tu itinerario de punta a punta.</p>
      </div>
      {children}
    </main>
  );
}
