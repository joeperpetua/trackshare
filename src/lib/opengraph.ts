const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  ndash: "–",
  mdash: "—",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, code: string) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}

/** All <meta property|name=… content=…> pairs, keyed by lower-case name. First value wins; repeated keys are kept in `all`. */
export function parseMeta(html: string): { get: (key: string) => string | undefined; all: (key: string) => string[] } {
  const map = new Map<string, string[]>();
  const tagRe = /<meta\b[^>]*>/gi;
  for (const tag of html.match(tagRe) ?? []) {
    const attr = (name: string) => {
      const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i"));
      return m ? (m[2] ?? m[3]) : undefined;
    };
    const key = (attr("property") ?? attr("name") ?? attr("itemprop"))?.toLowerCase();
    const content = attr("content");
    if (!key || content === undefined) continue;
    const list = map.get(key) ?? [];
    list.push(decodeEntities(content).trim());
    map.set(key, list);
  }
  return {
    get: (key) => map.get(key.toLowerCase())?.[0] || undefined,
    all: (key) => map.get(key.toLowerCase()) ?? [],
  };
}

export function canonicalUrl(html: string): string | undefined {
  const link = html.match(/<link\b[^>]*rel=["']canonical["'][^>]*>/i)?.[0];
  return link?.match(/href=["']([^"']+)["']/i)?.[1];
}
