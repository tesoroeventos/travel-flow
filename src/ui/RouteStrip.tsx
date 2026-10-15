/** Línea de ruta: origen, paradas y destino unidos como en un mapa de líneas. */
export function RouteStrip({ points }: { points: string[] }) {
  const middle = points.slice(1, -1);
  return (
    <div className="mt-4">
      <div className="flex items-center gap-3">
        <span className="font-semibold">{points[0]}</span>
        <div className="route-line relative min-w-10 flex-1" aria-hidden>
          {middle.map((_, i) => (
            <span
              key={i}
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface ring-[3px] ring-route"
              style={{ left: `${((i + 1) / (middle.length + 1)) * 100}%` }}
            />
          ))}
        </div>
        <span className="font-semibold">{points[points.length - 1]}</span>
      </div>
      {middle.length > 0 ? <p className="mt-1 text-sm text-ink-soft">Pasando por {middle.join(", ")}</p> : null}
    </div>
  );
}
