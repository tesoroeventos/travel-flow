/**
 * Aeropuertos comerciales de Argentina y los principales de países vecinos.
 * Lista fija: no gasta búsquedas y nunca sugiere lugares que no tienen que ver (Surat, Ciudad Victoria).
 */
export interface Airport {
  code: string;
  city: string;
  region: string;
  country: string;
  /** Lo que se manda a Google Flights. */
  flightIds: string;
  aliases: string[];
}

const ar = (code: string, city: string, region: string, aliases: string[] = [], flightIds = code): Airport => ({
  code,
  city,
  region,
  country: "Argentina",
  flightIds,
  aliases,
});
const ext = (code: string, city: string, country: string, aliases: string[] = [], flightIds = code): Airport => ({
  code,
  city,
  region: country,
  country,
  flightIds,
  aliases,
});

export const AIRPORTS: readonly Airport[] = [
  ar(
    "BUE",
    "Buenos Aires",
    "Buenos Aires",
    [
      "Zárate",
      "Campana",
      "Ezeiza",
      "Aeroparque",
      "CABA",
      "Capital Federal",
      "EZE",
      "AEP",
      "Escobar",
      "Pilar",
      "La Plata",
    ],
    "EZE,AEP",
  ),
  ar("COR", "Córdoba", "Córdoba", ["Villa Carlos Paz", "Pajas Blancas"]),
  ar("MDZ", "Mendoza", "Mendoza"),
  ar("BRC", "San Carlos de Bariloche", "Río Negro", ["Bariloche", "Villa La Angostura"]),
  ar("IGR", "Puerto Iguazú", "Misiones", ["Iguazú", "Cataratas"]),
  ar("FTE", "El Calafate", "Santa Cruz", ["Calafate", "El Chaltén"]),
  ar("USH", "Ushuaia", "Tierra del Fuego"),
  ar("SLA", "Salta", "Salta"),
  ar("TUC", "San Miguel de Tucumán", "Tucumán", ["Tucumán"]),
  ar("NQN", "Neuquén", "Neuquén"),
  ar("ROS", "Rosario", "Santa Fe"),
  ar("MDQ", "Mar del Plata", "Buenos Aires"),
  ar("REL", "Trelew", "Chubut", ["Puerto Madryn", "Península Valdés"]),
  ar("PMY", "Puerto Madryn", "Chubut", ["Madryn"]),
  ar("CRD", "Comodoro Rivadavia", "Chubut", ["Comodoro"]),
  ar("RGL", "Río Gallegos", "Santa Cruz", ["Gallegos"]),
  ar("CPC", "San Martín de los Andes", "Neuquén", ["Chapelco", "Junín de los Andes"]),
  ar("EQS", "Esquel", "Chubut"),
  ar("JUJ", "San Salvador de Jujuy", "Jujuy", ["Jujuy", "Purmamarca", "Tilcara"]),
  ar("SDE", "Santiago del Estero", "Santiago del Estero"),
  ar("RHD", "Termas de Río Hondo", "Santiago del Estero", ["Río Hondo"]),
  ar("CTC", "San Fernando del Valle de Catamarca", "Catamarca", ["Catamarca"]),
  ar("IRJ", "La Rioja", "La Rioja"),
  ar("UAQ", "San Juan", "San Juan"),
  ar("LUQ", "San Luis", "San Luis"),
  ar("AFA", "San Rafael", "Mendoza"),
  ar("RES", "Resistencia", "Chaco"),
  ar("CNQ", "Corrientes", "Corrientes"),
  ar("PSS", "Posadas", "Misiones"),
  ar("FMA", "Formosa", "Formosa"),
  ar("PRA", "Paraná", "Entre Ríos"),
  ar("SFN", "Santa Fe", "Santa Fe"),
  ar("BHI", "Bahía Blanca", "Buenos Aires"),
  ar("RSA", "Santa Rosa", "La Pampa"),
  ar("VDM", "Viedma", "Río Negro"),
  ar("RCU", "Río Cuarto", "Córdoba"),
  ar("VLG", "Villa Gesell", "Buenos Aires", ["Pinamar", "Cariló"]),
  ext("SCL", "Santiago", "Chile", ["Santiago de Chile"]),
  ext("MVD", "Montevideo", "Uruguay"),
  ext("PDP", "Punta del Este", "Uruguay", ["Maldonado"]),
  ext("ASU", "Asunción", "Paraguay"),
  ext("VVI", "Santa Cruz de la Sierra", "Bolivia"),
  ext("LPB", "La Paz", "Bolivia"),
  ext("GRU", "São Paulo", "Brasil", ["Sao Paulo", "San Pablo"], "GRU,CGH"),
  ext("GIG", "Río de Janeiro", "Brasil", ["Rio de Janeiro", "Río"], "GIG,SDU"),
  ext("FLN", "Florianópolis", "Brasil", ["Floripa"]),
  ext("POA", "Porto Alegre", "Brasil"),
  ext("SSA", "Salvador de Bahía", "Brasil", ["Salvador", "Bahía"]),
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

function score(a: Airport, t: string): number {
  if (norm(a.code) === t) return 100;
  const city = norm(a.city);
  const aliases = a.aliases.map(norm);
  if (city === t || aliases.includes(t)) return 90;
  if (city.startsWith(t)) return 80;
  if (aliases.some((x) => x.startsWith(t))) return 70;
  if (city.includes(t)) return 60;
  if (aliases.some((x) => x.includes(t)) || norm(a.region).includes(t)) return 40;
  return 0;
}

export function searchAirports(term: string, limit = 6): Airport[] {
  const t = norm(term);
  if (t.length < 2) return [];
  return AIRPORTS.map((a, i) => ({ a, i, s: score(a, t) }))
    .filter((x) => x.s > 0)
    .sort((x, y) => y.s - x.s || Number(y.a.country === "Argentina") - Number(x.a.country === "Argentina") || x.i - y.i)
    .slice(0, limit)
    .map((x) => x.a);
}

export function findAirport(code: string): Airport | undefined {
  const c = code.trim().toUpperCase();
  return AIRPORTS.find((a) => a.code === c);
}
