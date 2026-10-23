import { fetchHtml, fetchJson } from "../http";
import { parseMeta } from "../opengraph";
import { MediaInfo, MediaKind, ResolveError } from "../types";

interface Parsed {
  kind: MediaKind;
  id: string;
}

type Base = Pick<MediaInfo, "source" | "sourceName" | "url">;

export function parseSpotifyUrl(url: URL): Parsed | null {
  // /track/{id}, /intl-de/album/{id}, /user/x/playlist/{id} (old form)
  const m = url.pathname.match(/\/(track|album|playlist)\/([A-Za-z0-9]{10,40})/);
  if (!m) return null;
  return { kind: m[1] as MediaKind, id: m[2] };
}

interface SpImage {
  url: string;
  width: number | null;
}
const biggest = (imgs: SpImage[] | undefined) =>
  [...(imgs ?? [])].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url;

/* ---------- The embed page's __NEXT_DATA__ ---------- */

interface EmbedImage {
  url: string;
  maxWidth?: number | null;
}

interface EmbedEntity {
  name?: string;
  title?: string;
  subtitle?: string;
  artists?: { name?: string }[];
  trackList?: unknown[];
  visualIdentity?: { image?: EmbedImage[] };
  coverArt?: { sources?: SpImage[] };
}

/** The embed page never lists more than this, so a full count is not available above it. */
const TRACKLIST_CAP = 100;

function embedEntity(html: string): EmbedEntity | null {
  const raw = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } } };
    return data.props?.pageProps?.state?.data?.entity ?? null;
  } catch {
    return null;
  }
}

const embedCover = (e: EmbedEntity) =>
  [...(e.visualIdentity?.image ?? [])].sort((a, b) => (b.maxWidth ?? 0) - (a.maxWidth ?? 0))[0]?.url ??
  biggest(e.coverArt?.sources);

function embedCount(e: EmbedEntity): Pick<MediaInfo, "trackCount" | "trackCountIsMinimum"> {
  const n = e.trackList?.length;
  if (!n) return {};
  return n >= TRACKLIST_CAP ? { trackCount: TRACKLIST_CAP, trackCountIsMinimum: true } : { trackCount: n };
}

function namedArtists(e: EmbedEntity): string[] {
  const named = (e.artists ?? []).map((a) => a.name?.trim()).filter((n): n is string => !!n);
  if (named.length) return named;
  return (e.subtitle ?? "").split(",").map((a) => a.trim()).filter(Boolean);
}

async function viaEmbed(p: Parsed, base: Base): Promise<MediaInfo> {
  const { html } = await fetchHtml(`https://open.spotify.com/embed/${p.kind}/${p.id}`);
  const e = embedEntity(html);
  const title = e?.name || e?.title;
  const coverUrl = e ? embedCover(e) : undefined;
  if (!e || !title || !coverUrl) throw new ResolveError("spotifyNoMetadata", 502);

  if (p.kind === "playlist") {
    return {
      ...base,
      kind: "playlist",
      title,
      artists: [],
      curator: e.subtitle || undefined,
      ...embedCount(e),
      coverUrl,
    };
  }
  return {
    ...base,
    kind: p.kind,
    title,
    artists: namedArtists(e),
    ...(p.kind === "album" ? embedCount(e) : {}),
    coverUrl,
  };
}

/* ---------- Last resort: oEmbed + page metadata ---------- */

async function viaPage(p: Parsed, base: Base): Promise<MediaInfo> {
  const canonical = `https://open.spotify.com/${p.kind}/${p.id}`;
  const [oembed, page] = await Promise.all([
    fetchJson<{ title: string; thumbnail_url: string }>(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(canonical)}`,
    ).catch(() => null),
    fetchHtml(canonical).catch(() => null),
  ]);
  const meta = page ? parseMeta(page.html) : null;
  const title = oembed?.title ?? meta?.get("og:title");
  const coverUrl = oembed?.thumbnail_url ?? meta?.get("og:image");
  if (!title || !coverUrl) throw new ResolveError("spotifyNoMetadata", 502);

  // og:description examples:
  //   track:    "Artist · Album · Song · 2021"
  //   album:    "Artist · album · 2021 · 12 songs"
  //   playlist: "Playlist · Owner · 50 items · 1.2K saves"
  const parts = (meta?.get("og:description") ?? "").split(" · ").map((s) => s.trim()).filter(Boolean);
  const countPart = parts.find((s) => /^\d[\d,.]*\s+(songs?|items?|tracks?)$/i.test(s));
  const trackCount = countPart ? Number(countPart.replace(/[^\d]/g, "")) : undefined;

  if (p.kind === "playlist") {
    return { ...base, kind: "playlist", title, artists: [], curator: parts[1], trackCount, coverUrl };
  }
  const musicians = meta?.all("music:musician_description") ?? [];
  const artists = musicians.length ? musicians : parts[0] ? [parts[0]] : [];
  return { ...base, kind: p.kind, title, artists, trackCount: p.kind === "album" ? trackCount : undefined, coverUrl };
}

export async function resolveSpotify(url: URL, base: Base): Promise<MediaInfo> {
  const p = parseSpotifyUrl(url);
  if (!p) throw new ResolveError("spotifyLinkKind", 400);

  // open.spotify.com no longer serves og:title or music:musician_description to a browser.
  const embed = await viaEmbed(p, base).catch(() => null);
  if (embed && (embed.artists.length > 0 || p.kind === "playlist")) return embed;
  if (!embed) return viaPage(p, base);

  const page = await viaPage(p, base).catch(() => null);
  return page && page.artists.length > 0 ? page : embed;
}
