export const RADAR_MESSAGES = {
  unavailable: "No pude traer los precios de referencia ahora. Los enlaces funcionan igual.",
  no_data: "Nadie buscó esta ruta en los últimos días. Usá los enlaces.",
  bad_token: "El token de Travelpayouts no es válido. Revisá TRAVELPAYOUTS_TOKEN.",
  no_airports: "Elegí los aeropuertos para buscar vuelos.",
  no_prefill: "Abre la página principal: cargá los datos a mano.",
  not_configured: "Precios de referencia no configurados",
} as const;

export type RadarErrorCode = keyof typeof RADAR_MESSAGES;
