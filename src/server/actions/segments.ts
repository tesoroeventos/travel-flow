export interface RawSegment {
  from: string;
  to: string;
  departDate: string;
  departTime: string;
  departTz: string;
  arriveDate: string;
  arriveTime: string;
  arriveTz: string;
}

/**
 * Arma los tramos a partir de campos planos del formulario:
 * seg_departDate_i, seg_departTime_i, seg_arriveDate_i, seg_arriveTime_i, seg_arriveTz_i y
 * seg_via_i (punto de conexión antes del tramo i, i ≥ 1).
 */
export function segmentsFromForm(obj: Record<string, unknown>): RawSegment[] {
  const s = (k: string) => (typeof obj[k] === "string" ? (obj[k] as string).trim() : "");
  const tz = s("tz") || "America/Argentina/Buenos_Aires";
  const indexes: number[] = [];
  for (let i = 0; i < 10; i++) if (s(`seg_departDate_${i}`)) indexes.push(i);
  return indexes.map((i, n) => {
    const from = n === 0 ? s("fromLabel") : s(`seg_via_${i}`);
    const nextIdx = indexes[n + 1];
    const to = nextIdx === undefined ? s("toLabel") : s(`seg_via_${nextIdx}`);
    const prevArriveTz = n === 0 ? tz : s(`seg_arriveTz_${indexes[n - 1]}`) || tz;
    return {
      from,
      to,
      departDate: s(`seg_departDate_${i}`),
      departTime: s(`seg_departTime_${i}`),
      departTz: s(`seg_departTz_${i}`) || prevArriveTz,
      arriveDate: s(`seg_arriveDate_${i}`),
      arriveTime: s(`seg_arriveTime_${i}`),
      arriveTz: s(`seg_arriveTz_${i}`) || tz,
    };
  });
}
