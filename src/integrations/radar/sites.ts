import type { RadarQuery } from "@/domain/radar/query";

/**
 * Sitios donde buscar por fuera de la app. La app solo arma la dirección:
 * nunca descarga ni lee estas páginas. Sumar un sitio = sumar una entrada y su prueba.
 */
export interface RadarSite {
  id: string;
  name: string;
  group: "vuelos" | "aerolineas" | "micros" | "alojamiento";
  /** false: abre la página principal y hay que cargar los datos a mano. */
  prefills: boolean;
  /** La dirección lleva chicos y bebés. */
  supportsChildren: boolean;
  /** Última vez que se probó el formato a mano (YYYY-MM-DD); vacío si todavía no. */
  verifiedAt: string;
  /** null si faltan datos (por ejemplo, sin códigos de aeropuerto). */
  buildUrl(q: RadarQuery): string | null;
}

export const RADAR_GROUPS: { id: RadarSite["group"]; label: string }[] = [
  { id: "vuelos", label: "Vuelos" },
  { id: "aerolineas", label: "Aerolíneas" },
  { id: "micros", label: "Micros" },
  { id: "alojamiento", label: "Alojamiento" },
];

const enc = encodeURIComponent;

/** Arma "?a=1&b=2" codificando espacios como %20. */
function qs(params: Record<string, string | number>): string {
  return (
    "?" +
    Object.entries(params)
      .map(([k, v]) => `${enc(k)}=${enc(String(v))}`)
      .join("&")
  );
}

/** YYYY-MM-DD → YYMMDD (Skyscanner). */
const yymmdd = (d: string) => d.slice(2).replaceAll("-", "");

type Route = { from: string; to: string };
function route(q: RadarQuery): Route | null {
  return q.originIata && q.destinationIata ? { from: q.originIata, to: q.destinationIata } : null;
}

/** Vuelo o aerolínea: necesita códigos de aeropuerto aunque abra la página principal. */
function flight(build: (r: Route, q: RadarQuery) => string) {
  return (q: RadarQuery) => {
    const r = route(q);
    return r ? build(r, q) : null;
  };
}

function home(url: string) {
  return () => url;
}

export const RADAR_SITES: readonly RadarSite[] = [
  {
    id: "google-flights",
    name: "Google Flights",
    group: "vuelos",
    prefills: true,
    supportsChildren: false,
    verifiedAt: "2026-11-14",
    buildUrl: flight(
      (r, q) =>
        `https://www.google.com/travel/flights${qs({
          q: `Flights from ${r.from} to ${r.to} on ${q.depart} through ${q.return} for ${q.adults} adults`,
          hl: "es-419",
        })}`,
    ),
  },
  {
    id: "skyscanner",
    name: "Skyscanner",
    group: "vuelos",
    prefills: true,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: flight(
      (r, q) =>
        `https://www.skyscanner.com.ar/transporte/vuelos/${r.from.toLowerCase()}/${r.to.toLowerCase()}/${yymmdd(q.depart)}/${yymmdd(q.return)}/${qs({ adultsv2: q.adults, rtn: 1 })}`,
    ),
  },
  {
    id: "kayak",
    name: "Kayak",
    group: "vuelos",
    prefills: true,
    supportsChildren: false,
    verifiedAt: "2026-11-14",
    buildUrl: flight(
      (r, q) => `https://www.kayak.com.ar/flights/${r.from}-${r.to}/${q.depart}/${q.return}/${q.adults}adults`,
    ),
  },
  {
    id: "despegar-vuelos",
    name: "Despegar",
    group: "vuelos",
    prefills: true,
    supportsChildren: true,
    verifiedAt: "2026-11-14",
    buildUrl: flight(
      (r, q) =>
        `https://www.despegar.com.ar/shop/flights/results/roundtrip/${r.from}/${r.to}/${q.depart}/${q.return}/${q.adults}/${q.children}/${q.infants}`,
    ),
  },
  {
    id: "almundo",
    name: "Almundo",
    group: "vuelos",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: flight(home("https://almundo.com.ar/")),
  },
  {
    id: "aerolineas",
    name: "Aerolíneas Argentinas",
    group: "aerolineas",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: flight(home("https://www.aerolineas.com.ar/")),
  },
  {
    id: "flybondi",
    name: "Flybondi",
    group: "aerolineas",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: flight(home("https://flybondi.com/ar")),
  },
  {
    id: "jetsmart",
    name: "JetSMART",
    group: "aerolineas",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: flight(home("https://jetsmart.com/ar/es/")),
  },
  {
    id: "latam",
    name: "LATAM",
    group: "aerolineas",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: flight(home("https://www.latamairlines.com/ar/es")),
  },
  {
    id: "gol",
    name: "GOL",
    group: "aerolineas",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: flight(home("https://www.voegol.com.br/es")),
  },
  {
    id: "plataforma10",
    name: "Plataforma 10",
    group: "micros",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: home("https://www.plataforma10.com.ar/"),
  },
  {
    id: "centraldepasajes",
    name: "Central de Pasajes",
    group: "micros",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: home("https://www.centraldepasajes.com.ar/"),
  },
  {
    id: "booking",
    name: "Booking",
    group: "alojamiento",
    prefills: true,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: (q) =>
      `https://www.booking.com/searchresults.es.html${qs({
        ss: q.destinationLabel,
        checkin: q.depart,
        checkout: q.return,
        group_adults: q.adults,
        no_rooms: q.rooms,
      })}`,
  },
  {
    id: "airbnb",
    name: "Airbnb",
    group: "alojamiento",
    prefills: true,
    supportsChildren: true,
    verifiedAt: "",
    buildUrl: (q) =>
      `https://www.airbnb.com.ar/s/${enc(q.destinationLabel)}/homes${qs({
        checkin: q.depart,
        checkout: q.return,
        adults: q.adults,
        children: q.children,
        infants: q.infants,
      })}`,
  },
  {
    id: "vrbo",
    name: "Vrbo",
    group: "alojamiento",
    prefills: true,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: (q) =>
      `https://www.vrbo.com/search${qs({
        destination: q.destinationLabel,
        startDate: q.depart,
        endDate: q.return,
        adults: q.adults,
      })}`,
  },
  {
    id: "google-hotels",
    name: "Google Hotels",
    group: "alojamiento",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: (q) =>
      `https://www.google.com/travel/search${qs({ q: `hoteles en ${q.destinationLabel}`, hl: "es-419" })}`,
  },
  {
    id: "despegar-alojamiento",
    name: "Despegar",
    group: "alojamiento",
    prefills: false,
    supportsChildren: false,
    verifiedAt: "",
    buildUrl: home("https://www.despegar.com.ar/hoteles/"),
  },
];

export function findSite(id: string): RadarSite | undefined {
  return RADAR_SITES.find((s) => s.id === id);
}
