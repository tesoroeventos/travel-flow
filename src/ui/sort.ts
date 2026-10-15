export type TransportSort = "price" | "duration" | "price_per_hour" | "transfers" | "comfort";

export const TRANSPORT_SORT_LABELS: Record<TransportSort, string> = {
  price: "Menor precio",
  duration: "Menor duración",
  price_per_hour: "Mejor precio por hora",
  transfers: "Menos transbordos",
  comfort: "Mayor comodidad",
};

export interface SortableTransport {
  id: string;
  totalCents: number | null;
  durationMin: number | null;
  transfers: number | null;
  comfort: number | null;
}

function key(o: SortableTransport, by: TransportSort): number | null {
  switch (by) {
    case "price":
      return o.totalCents;
    case "duration":
      return o.durationMin;
    case "price_per_hour":
      return o.totalCents !== null && o.durationMin ? o.totalCents / (o.durationMin / 60) : null;
    case "transfers":
      return o.transfers;
    case "comfort":
      return o.comfort === null ? null : -o.comfort;
  }
}

/** Ordena alternativas; las que no tienen el dato van al final, en su orden original. */
export function sortTransport<T extends SortableTransport>(list: T[], by: TransportSort): T[] {
  return list
    .map((o, i) => ({ o, i, k: key(o, by) }))
    .sort((a, b) => {
      if (a.k === null && b.k === null) return a.i - b.i;
      if (a.k === null) return 1;
      if (b.k === null) return -1;
      return a.k - b.k || a.i - b.i;
    })
    .map((x) => x.o);
}
