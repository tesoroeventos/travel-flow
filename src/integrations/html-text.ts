const MAX_CHARS = 30_000;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};
const decode = (s: string) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === "#") {
      const code = e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isInteger(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const BLOCKS = ["script", "style", "noscript", "svg", "template"];

/** Saca bloques <script>…</script> y similares en una sola pasada; un bloque sin cerrar corta el resto. */
function stripBlocks(html: string): string {
  const lower = html.toLowerCase();
  const open = new RegExp(`<(${BLOCKS.join("|")})\\b`, "g");
  let out = "";
  let pos = 0;
  for (;;) {
    open.lastIndex = pos;
    const m = open.exec(lower);
    if (!m) break;
    out += html.slice(pos, m.index) + " ";
    const close = lower.indexOf(`</${m[1]}`, m.index + m[0].length);
    if (close < 0) return out;
    const gt = lower.indexOf(">", close);
    pos = gt < 0 ? html.length : gt + 1;
  }
  return out + html.slice(pos);
}

/** Saca comentarios en una sola pasada; uno sin cerrar corta el resto. */
function stripComments(html: string): string {
  let out = "";
  let pos = 0;
  for (;;) {
    const start = html.indexOf("<!--", pos);
    if (start < 0) return out + html.slice(pos);
    out += html.slice(pos, start) + " ";
    const end = html.indexOf("-->", start + 4);
    if (end < 0) return out;
    pos = end + 3;
  }
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Texto útil de una página: título, metadatos, JSON-LD y texto visible. */
export function htmlToText(html: string): string {
  const parts: string[] = [];
  const lower = html.toLowerCase();
  const tOpen = /<title[^>]*>/i.exec(html);
  if (tOpen) {
    const tEnd = lower.indexOf("</title", tOpen.index + tOpen[0].length);
    if (tEnd >= 0) parts.push(`Título: ${squash(decode(html.slice(tOpen.index + tOpen[0].length, tEnd)))}`);
  }
  for (const m of html.matchAll(/<meta\s+[^>]*>/gi)) {
    const tag = m[0];
    const name = /(?:property|name)\s*=\s*["']([^"']+)["']/i.exec(tag)?.[1]?.toLowerCase() ?? "";
    const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1];
    if (
      content &&
      (name === "description" || name.startsWith("og:") || name.startsWith("product:") || name.startsWith("twitter:"))
    ) {
      parts.push(`${name}: ${squash(decode(content))}`);
    }
  }
  for (const m of html.matchAll(/<script\b[^>]*>/gi)) {
    if (!/type\s*=\s*["']application\/ld\+json["']/i.test(m[0])) continue;
    const start = m.index! + m[0].length;
    const end = lower.indexOf("</script", start);
    if (end < 0) break;
    parts.push(`JSON-LD: ${squash(html.slice(start, end))}`);
  }
  const visible = stripComments(stripBlocks(html))
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  parts.push(decode(visible).split("\n").map(squash).filter(Boolean).join("\n"));
  return parts.join("\n").slice(0, MAX_CHARS);
}
