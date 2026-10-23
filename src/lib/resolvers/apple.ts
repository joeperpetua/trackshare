import { fetchHtml, fetchJson } from "../http";
import { parseMeta } from "../opengraph";
import { MediaInfo, ResolveError } from "../types";

type Base = Pick<MediaInfo, "source" | "sourceName" | "url">;

interface LookupItem {
  wrapperType: "track" | "collection" | "artist";
  trackName?: string;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  trackCount?: number;
}

const bigArtwork = (u?: string) => u?.replace(/\/\d+x\d+(bb)?\.(jpg|png|webp)$/, "/1200x1200bb.jpg");

export async function resolveAppleMusic(url: URL, base: Base): Promise<MediaInfo> {
  // /{cc}/album/{slug}/{id}?i={trackId} · /{cc}/song/{slug}/{id} · /{cc}/playlist/{slug}/pl.xxx
  const segs = url.pathname.split("/").filter(Boolean);
  const country = /^[a-z]{2}$/.test(segs[0] ?? "") ? segs[0] : "us";
  const type = segs.find((s) => ["album", "song", "playlist"].includes(s));
  const lastId = segs[segs.length - 1];
  const trackParam = url.searchParams.get("i");

  if (type === "song" || (type === "album" && trackParam)) {
    const id = trackParam ?? lastId;
    if (!/^\d+$/.test(id)) throw new ResolveError("appleSongIdUnreadable", 400);
    const d = await fetchJson<{ results: LookupItem[] }>(`https://itunes.apple.com/lookup?id=${id}&country=${country}`);
    const t = d.results.find((r) => r.wrapperType === "track");
    if (!t?.trackName) throw new ResolveError("appleSongNotFound", 404);
    return { ...base, kind: "track", title: t.trackName, artists: t.artistName ? [t.artistName] : [], coverUrl: bigArtwork(t.artworkUrl100) ?? "" };
  }

  if (type === "album") {
    const id = lastId;
    if (!/^\d+$/.test(id)) throw new ResolveError("appleAlbumIdUnreadable", 400);
    const d = await fetchJson<{ results: LookupItem[] }>(`https://itunes.apple.com/lookup?id=${id}&country=${country}`);
    const c = d.results.find((r) => r.wrapperType === "collection");
    if (!c?.collectionName) throw new ResolveError("appleAlbumNotFound", 404);
    return {
      ...base,
      kind: "album",
      title: c.collectionName,
      artists: c.artistName ? [c.artistName] : [],
      trackCount: c.trackCount,
      coverUrl: bigArtwork(c.artworkUrl100) ?? "",
    };
  }

  if (type === "playlist") {
    const { html } = await fetchHtml(url.toString());
    const meta = parseMeta(html);
    const rawTitle = meta.get("og:title") ?? meta.get("twitter:title");
    const coverUrl = meta.get("og:image");
    if (!rawTitle || !coverUrl) throw new ResolveError("applePlaylistNoMetadata", 502);
    // "Name by Curator on Apple Music" or "Name - Playlist - Apple Music"
    const cleaned = rawTitle.replace(/\s*(on|-)\s*Apple Music$/i, "").replace(/\s*-\s*Playlist$/i, "");
    const by = cleaned.match(/^(.+?)\s+by\s+(.+)$/i);
    const count = (meta.get("og:description") ?? "").match(/(\d[\d,]*)\s+(songs|tracks)/i)?.[1];
    return {
      ...base,
      kind: "playlist",
      title: by ? by[1] : cleaned,
      artists: [],
      curator: by?.[2],
      trackCount: count ? Number(count.replace(/,/g, "")) : undefined,
      coverUrl: coverUrl.replace(/\/\d+x\d+[a-z]*\.(jpg|png|webp)$/, "/1200x1200cc.jpg"),
    };
  }

  throw new ResolveError("appleLinkKind", 400);
}
