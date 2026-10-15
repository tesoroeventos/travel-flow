import type { CarEstimate, OfferBasis, OfferDraft, OfferKind, TripDraft } from "./types";

const KINDS: OfferKind[] = ["vuelo", "micro", "tren", "auto_alquiler", "alojamiento", "actividad", "otro"];
const TRANSPORT: OfferKind[] = ["vuelo", "micro", "tren"];
const BASES: OfferBasis[] = ["total", "por_persona", "por_noche", "por_persona_por_noche", "por_dia"];
const MAX_OFFERS = 6;

/** Campos en español que devuelve la IA → nombres internos. */
const DOUBT_NAMES: Record<string, string> = {
  tipo: "kind",
  sentido: "direction",
  nombre: "name",
  empresa: "company",
  origen: "from",
  destino: "to",
  salida: "depart",
  llegada: "arrive",
  duracion_min: "durationMin",
  escalas: "stops",
  precio: "price",
  moneda: "currency",
  base: "basis",
  noches: "nights",
  puntaje: "score",
  confort: "comfort",
};
const TRIP_DOUBT: Record<string, string> = {
  destino: "destination",
  origen: "origin",
  salida: "startDate",
  regreso: "endDate",
  personas: "travelers",
  presupuesto: "budget",
  moneda: "currency",
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max: number) =>
  typeof v === "string" || typeof v === "number" ? String(v).trim().slice(0, max) : "";

/** Número tolerante: "$ 1.234.567", "US$ 1,234.50", "1,5 millones", "800 mil". */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  let s = v.toLowerCase();
  let mult = 1;
  if (s.includes("mill")) mult = 1e6;
  else if (/\bmil\b/.test(s)) mult = 1e3;
  s = s.replace(/[^\d.,]/g, "");
  if (!/\d/.test(s)) return null;
  const hasD = s.includes(".");
  const hasC = s.includes(",");
  let dec: string | null = null;
  if (hasD && hasC) dec = s.lastIndexOf(".") > s.lastIndexOf(",") ? "." : ",";
  else if (hasD || hasC) {
    const c = hasD ? "." : ",";
    const parts = s.split(c);
    if (parts.length === 2 && parts[1]!.length !== 3) dec = c;
  }
  let t = s;
  if (dec)
    t = t
      .split(dec === "." ? "," : ".")
      .join("")
      .replace(dec, ".");
  else t = t.replace(/[.,]/g, "");
  const n = Number.parseFloat(t);
  return Number.isFinite(n) ? n * mult : null;
}

function validDate(y: number, m: number, d: number) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** "YYYY-MM-DDTHH:MM" o "YYYY-MM-DD" válidos; cualquier otra cosa es null. */
export function toLocalDateTime(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(v.trim());
  if (!m) return null;
  if (!validDate(+m[1]!, +m[2]!, +m[3]!)) return null;
  if (m[4] === undefined) return `${m[1]}-${m[2]}-${m[3]}`;
  if (+m[4] > 23 || +m[5]! > 59) return null;
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
}

const toDate = (v: unknown) => toLocalDateTime(v)?.slice(0, 10) ?? null;
const toInt = (v: unknown) => {
  const n = toNumber(v);
  return n === null ? null : Math.round(n);
};

function parseOne(x: unknown): OfferDraft | null {
  if (!isObj(x)) return null;
  const doubt = new Set<string>(
    (Array.isArray(x.dudosos) ? x.dudosos : [])
      .map((d) => DOUBT_NAMES[String(d)] ?? String(d))
      .filter((d) => Object.values(DOUBT_NAMES).includes(d)),
  );
  const kind = KINDS.includes(x.tipo as OfferKind) ? (x.tipo as OfferKind) : "otro";
  let direction: OfferDraft["direction"] = null;
  if (TRANSPORT.includes(kind)) {
    direction = x.sentido === "ida" || x.sentido === "vuelta" || x.sentido === "ida_y_vuelta" ? x.sentido : null;
    if (!direction) {
      direction = "ida";
      doubt.add("direction");
    }
  }
  const depart = toLocalDateTime(x.salida);
  const arrive = toLocalDateTime(x.llegada);
  if (x.salida && !depart) doubt.add("depart");
  if (x.llegada && !arrive) doubt.add("arrive");
  const price = toNumber(x.precio);
  if (price === null || price < 0) doubt.add("price");
  const comfortRaw = toNumber(x.confort);
  const duration = toInt(x.duracion_min);
  return {
    kind,
    direction,
    name: str(x.nombre, 90),
    company: str(x.empresa, 60),
    from: str(x.origen, 60),
    to: str(x.destino, 60),
    depart,
    arrive,
    durationMin: duration !== null && duration > 0 && duration < 7 * 24 * 60 ? duration : null,
    stops: (() => {
      const s = toInt(x.escalas);
      return s !== null && s >= 0 && s < 10 ? s : null;
    })(),
    price: price !== null && price >= 0 ? price : null,
    currency: x.moneda === "USD" ? "USD" : "ARS",
    basis: BASES.includes(x.base as OfferBasis) ? (x.base as OfferBasis) : "total",
    nights: (() => {
      const n = toInt(x.noches);
      return n !== null && n > 0 && n < 120 ? n : null;
    })(),
    score: str(x.puntaje, 30) || null,
    comfort: Math.min(5, Math.max(1, Math.round(comfortRaw ?? 3))),
    detail: str(x.detalle, 160),
    doubtful: [...doubt],
  };
}

export function parseOffers(raw: unknown): OfferDraft[] {
  if (!isObj(raw) || !Array.isArray(raw.opciones)) return [];
  return raw.opciones
    .map(parseOne)
    .filter((o): o is OfferDraft => o !== null)
    .slice(0, MAX_OFFERS);
}

export function offersNotice(raw: unknown): string | null {
  return isObj(raw) && typeof raw.aviso === "string" && raw.aviso.trim() ? raw.aviso.trim().slice(0, 200) : null;
}

export function parseTripDraft(raw: unknown): TripDraft {
  const x = isObj(raw) ? raw : {};
  const doubt = new Set<string>(
    (Array.isArray(x.dudosos) ? x.dudosos : []).map((d) => TRIP_DOUBT[String(d)] ?? "").filter(Boolean),
  );
  const travelers = toInt(x.personas);
  const t: TripDraft = {
    destination: str(x.destino, 80) || null,
    origin: str(x.origen, 80) || null,
    startDate: toDate(x.salida),
    endDate: toDate(x.regreso),
    travelers: travelers !== null && travelers >= 1 && travelers <= 20 ? travelers : null,
    budget: (() => {
      const b = toNumber(x.presupuesto);
      return b !== null && b > 0 ? b : null;
    })(),
    currency: x.moneda === "USD" ? "USD" : "ARS",
    doubtful: [],
  };
  for (const k of ["destination", "origin", "startDate", "endDate", "travelers"] as const)
    if (t[k] === null) doubt.add(k);
  t.doubtful = [...doubt];
  return t;
}

export function parseCarEstimate(raw: unknown, givenConsumption: number | null): CarEstimate | null {
  if (!isObj(raw)) return null;
  const km = toNumber(raw.distancia_km);
  const hours = toNumber(raw.horas_manejo);
  const consumption = givenConsumption ?? toNumber(raw.consumo_l_100km);
  const fuelPrice = toNumber(raw.precio_litro);
  if (!km || km <= 0 || !hours || hours <= 0 || !consumption || consumption <= 0 || !fuelPrice || fuelPrice <= 0)
    return null;
  const doubt = new Set(["fuelPrice", "tolls"]);
  return {
    km,
    hours,
    tolls: Math.max(0, toNumber(raw.peajes) ?? 0),
    consumptionLPer100: consumption,
    fuelPrice,
    route: str(raw.ruta, 80),
    doubtful: [...doubt],
  };
}
