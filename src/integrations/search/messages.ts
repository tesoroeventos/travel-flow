export const SEARCH_MESSAGES = {
  not_configured: "Búsqueda automática no configurada. Cargá SERPAPI_KEY en Railway.",
  bad_key: "La clave de SerpApi no es válida. Revisá SERPAPI_KEY.",
  no_credits: "Se terminaron las búsquedas de SerpApi de este mes. Podés seguir con el radar y la carga rápida.",
  unavailable: "No pude buscar ahora. Probá de nuevo en un rato.",
  no_flights: "Google no mostró vuelos con precio para estas fechas.",
  return_failed: "Vuelta: confirmala en Google Flights.",
  noLodging: (n: number) => `No encontré alojamiento para ${n} personas en esas fechas.`,
} as const;
