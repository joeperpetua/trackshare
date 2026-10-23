import { fetchHtml, fetchJson } from "../http";
import { parseMeta } from "../opengraph";
import { isSupportedHost } from "../sources";
import { MediaInfo, MediaKind, ResolveError } from "../types";

type Base = Pick<MediaInfo, "source" | "sourceName" | "url">;

/* ---------- Odesli (song.link): universal lookup for tracks and albums ---------- */

interface OdesliResponse {
  entityUniqueId: string;
  entitiesByUniqueId: Record<
    string,
    { type: "song" | "album"; title?: string; artistName?: string; thumbnailUrl?: string }
  >;
}

export async function resolveViaOdesli(url: URL, base: Base): Promise<MediaInfo> {
  const d = await fetchJson<OdesliResponse>(
    `https://api.song.link/v1-alpha.1/links?url=${encodeURIComponent(url.toString())}`,
  );
  const e = d.entitiesByUniqueId[d.entityUniqueId];
  if (!e?.title || !e.thumbnailUrl) throw new ResolveError("noMetadata", 404);
  return {
    ...base,
    kind: e.type === "album" ? "album" : "track",
    title: e.title,
    artists: e.artistName ? e.artistName.split(/\s*,\s*/) : [],
    coverUrl: e.thumbnailUrl,
  };
}

/* ---------- Open Graph: last resort ---------- */

function guessKind(url: URL, ogType?: string): MediaKind {
  const s = `${url.pathname} ${ogType ?? ""}`.toLowerCase();
  if (/playlist|\/sets\//.test(s)) return "playlist";
  if (/album/.test(s)) return "album";
  return "track";
}

export async function resolveViaOpenGraph(url: URL, base: Base): Promise<MediaInfo> {
  const { html } = await fetchHtml(url.toString(), { allowHost: isSupportedHost });
  const meta = parseMeta(html);
  const rawTitle = meta.get("og:title") ?? meta.get("twitter:title");
  const coverUrl = meta.get("og:image") ?? meta.get("twitter:image");
  if (!rawTitle || !coverUrl) throw new ResolveError("noTitleOrCover", 404);

  const kind = guessKind(url, meta.get("og:type"));
  // Common shapes: "Title, by Artist" (Bandcamp) · "Title by Artist" · "Title - Artist"
  const by = rawTitle.match(/^(.+?),?\s+by\s+(.+)$/i);
  const title = by ? by[1] : rawTitle;
  const person = by?.[2] ?? meta.get("music:musician_description");

  if (kind === "playlist") return { ...base, kind, title, artists: [], curator: person, coverUrl };
  return { ...base, kind, title, artists: person ? [person] : [], coverUrl };
}
