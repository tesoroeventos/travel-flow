import { lookup as dnsLookup } from "node:dns";
import { isIP } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import { err, ok, type Result } from "@/domain/result";

const BLOCKED = "Este sitio no deja leer el link. Subí una captura de la página.";
const MAX_REDIRECTS = 3;
const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 8000;
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

function v4Blocked(ip: string): boolean {
  const p = ip.split(".").map(Number);
  const [a = 0, b = 0] = p;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  );
}

/** Los 16 bytes de una IPv6 (acepta "::" y una IPv4 al final); null si no es válida. */
function ipv6Bytes(ip: string): number[] | null {
  let s = ip.toLowerCase().split("%")[0]!;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const p = v4[1]!.split(".").map(Number);
    if (p.some((n) => n > 255)) return null;
    s = s.slice(0, -v4[1]!.length) + ((p[0]! << 8) | p[1]!).toString(16) + ":" + ((p[2]! << 8) | p[3]!).toString(16);
  }
  const halves = s.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = halves.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const words = [...head, ...Array<string>(fill).fill("0"), ...tail].map((w) => parseInt(w, 16));
  if (words.length !== 8 || words.some((w) => Number.isNaN(w) || w < 0 || w > 0xffff)) return null;
  return words.flatMap((w) => [w >> 8, w & 0xff]);
}

const v4Of = (b: number[], i: number) => `${b[i]}.${b[i + 1]}.${b[i + 2]}.${b[i + 3]}`;
const zero = (b: number[], from: number, to: number) => b.slice(from, to).every((x) => x === 0);

/** Direcciones privadas, locales, link-local, de metadatos o reservadas, también escondidas dentro de IPv6. */
export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return v4Blocked(ip);
  if (kind !== 6) return true;
  const b = ipv6Bytes(ip);
  if (!b) return true;
  if (zero(b, 0, 16)) return true; // ::
  if (zero(b, 0, 15) && b[15] === 1) return true; // ::1
  if (zero(b, 0, 12)) return v4Blocked(v4Of(b, 12)); // ::/96 (IPv4 compatible)
  if (zero(b, 0, 10) && b[10] === 0xff && b[11] === 0xff) return v4Blocked(v4Of(b, 12)); // ::ffff:0:0/96
  if (zero(b, 0, 8) && b[8] === 0xff && b[9] === 0xff && zero(b, 10, 12)) return v4Blocked(v4Of(b, 12)); // ::ffff:0:0:0/96
  if (b[0] === 0x00 && b[1] === 0x64 && b[2] === 0xff && b[3] === 0x9b) return v4Blocked(v4Of(b, 12)); // 64:ff9b::/96 y /48
  if (b[0] === 0x20 && b[1] === 0x02) return v4Blocked(v4Of(b, 2)); // 2002::/16 (6to4)
  if (b[0] === 0x20 && b[1] === 0x01 && b[2] === 0x00 && b[3] === 0x00) return true; // 2001::/32 (Teredo)
  if ((b[0]! & 0xfe) === 0xfc) return true; // fc00::/7
  if (b[0] === 0xfe && (b[1]! & 0xc0) === 0x80) return true; // fe80::/10
  if (b[0] === 0xff) return true; // multicast
  if (b[0] === 0x01 && zero(b, 1, 8)) return true; // 100::/64 descarte
  return false;
}

type Lookup = (host: string) => Promise<string[]>;
type FetchLike = (
  url: string,
  init: {
    redirect: "manual";
    signal: AbortSignal;
    headers: Record<string, string>;
  },
) => Promise<Response>;

const defaultLookup: Lookup = (host) =>
  new Promise((resolve, reject) =>
    dnsLookup(host, { all: true }, (e, addrs) => (e ? reject(e) : resolve(addrs.map((a) => a.address)))),
  );

/** Conecta solo a direcciones permitidas, aunque el DNS cambie entre la validación y la conexión. */
const pinnedAgent = new Agent({
  connect: {
    lookup: (host, opts, cb) =>
      dnsLookup(host, { ...opts, all: true }, (e, addrs) => {
        if (e) return cb(e, []);
        const list = addrs as { address: string; family: number }[];
        if (list.some((a) => isBlockedAddress(a.address))) return cb(new Error("dirección bloqueada"), []);
        cb(null, list);
      }),
  },
});

const defaultFetch: FetchLike = (url, init) =>
  undiciFetch(url, {
    ...init,
    dispatcher: pinnedAgent,
  }) as unknown as Promise<Response>;

async function allowed(url: URL, lookup: Lookup): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  if (url.username || url.password) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host)) return !isBlockedAddress(host);
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal")) return false;
  try {
    const addrs = await lookup(host);
    return addrs.length > 0 && !addrs.some(isBlockedAddress);
  } catch {
    return false;
  }
}

async function readCapped(res: Response): Promise<string | null> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
}

/** Descarga una página pública para leerla con IA, con todas las protecciones de red. */
export async function fetchPage(
  rawUrl: string,
  deps: { lookup?: Lookup; fetchImpl?: FetchLike } = {},
): Promise<Result<{ finalUrl: string; html: string }>> {
  const lookup = deps.lookup ?? defaultLookup;
  const doFetch = deps.fetchImpl ?? defaultFetch;
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return err("blocked", BLOCKED);
  }
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await allowed(url, lookup))) return err("blocked", BLOCKED);
      const res = await doFetch(url.toString(), {
        redirect: "manual",
        signal,
        headers: {
          "user-agent": UA,
          accept: "text/html,application/xhtml+xml",
          "accept-language": "es-AR,es;q=0.9",
        },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) return err("blocked", BLOCKED);
        url = new URL(loc, url);
        continue;
      }
      if (res.status < 200 || res.status >= 300) return err("blocked", BLOCKED);
      const html = await readCapped(res);
      if (html === null) return err("blocked", BLOCKED);
      return ok({ finalUrl: url.toString(), html });
    }
    return err("blocked", BLOCKED);
  } catch {
    return err("blocked", BLOCKED);
  }
}
