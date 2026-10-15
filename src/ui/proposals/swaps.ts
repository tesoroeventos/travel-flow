import type { ProposalTag } from "@/domain/decision/proposals";

export type SwapMap = Partial<Record<ProposalTag, { plan: number; lodging: number }>>;
const TAGS: ProposalTag[] = ["barata", "rapida", "comoda"];

/** Lee ?barata=plan,alojamiento de la URL. Descarta lo que no sean dos enteros no negativos. */
export function parseSwaps(sp: Record<string, string | string[] | undefined>): SwapMap {
  const out: SwapMap = {};
  for (const tag of TAGS) {
    const raw = sp[tag];
    const v = Array.isArray(raw) ? raw[0] : raw;
    const m = v ? /^(\d{1,3}),(\d{1,3})$/.exec(v) : null;
    if (m) out[tag] = { plan: Number(m[1]), lodging: Number(m[2]) };
  }
  return out;
}

export function swapHref(
  base: string,
  current: URLSearchParams,
  tag: ProposalTag,
  v: { plan: number; lodging: number } | null,
): string {
  const q = new URLSearchParams(current);
  if (v) q.set(tag, `${v.plan},${v.lodging}`);
  else q.delete(tag);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
