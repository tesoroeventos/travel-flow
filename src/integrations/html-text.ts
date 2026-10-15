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
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** Texto útil de una página: título, metadatos, JSON-LD y texto visible. */
export function htmlToText(html: string): string {
  const parts: string[] = [];
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (title) parts.push(`Título: ${squash(decode(title))}`);
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
  for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    parts.push(`JSON-LD: ${squash(m[1]!)}`);
  }
  const visible = html
    .replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  parts.push(decode(visible).split("\n").map(squash).filter(Boolean).join("\n"));
  return parts.join("\n").slice(0, MAX_CHARS);
}
