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

/** Direcciones privadas, locales, link-local, de metadatos o reservadas. */
export function isBlockedAddress(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return v4Blocked(ip);
  if (kind !== 6) return true;
  const s = ip.toLowerCase();
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (mapped) return v4Blocked(mapped[1]!);
  if (s === "::" || s === "::1") return true;
  const first = parseInt(s.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return true; // fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // fe80::/10
  if ((first & 0xff00) === 0xff00) return true; // multicast
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
