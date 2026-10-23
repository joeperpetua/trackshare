import { fetchJson } from "../http";
import { MediaInfo, MediaKind, ResolveError } from "../types";

type Base = Pick<MediaInfo, "source" | "sourceName" | "url">;

interface DzError {
  error?: { message: string };
}
interface DzTrack extends DzError {
  title: string;
  artist: { name: string };
  contributors?: { name: string }[];
  album: { cover_xl: string };
}
interface DzAlbum extends DzError {
  title: string;
  artist: { name: string };
  contributors?: { name: string }[];
  cover_xl: string;
  nb_tracks: number;
}
interface DzPlaylist extends DzError {
  title: string;
  creator?: { name: string };
  picture_xl: string;
  nb_tracks: number;
}

const unique = (xs: string[]) => [...new Set(xs.filter(Boolean))];

export async function resolveDeezer(url: URL, base: Base): Promise<MediaInfo> {
  const m = url.pathname.match(/\/(track|album|playlist)\/(\d+)/);
  if (!m) throw new ResolveError("deezerLinkKind", 400);
  const kind = m[1] as MediaKind;
  const id = m[2];
  const api = `https://api.deezer.com/${kind}/${id}`;

  if (kind === "track") {
    const d = await fetchJson<DzTrack>(api);
    if (d.error) throw new ResolveError("deezerApi", 404, { message: d.error.message });
    return {
      ...base,
      kind,
      title: d.title,
      artists: unique(d.contributors?.map((c) => c.name) ?? [d.artist.name]),
      coverUrl: d.album.cover_xl,
    };
  }
  if (kind === "album") {
    const d = await fetchJson<DzAlbum>(api);
    if (d.error) throw new ResolveError("deezerApi", 404, { message: d.error.message });
    return {
      ...base,
      kind,
      title: d.title,
      artists: unique(d.contributors?.map((c) => c.name) ?? [d.artist.name]),
      trackCount: d.nb_tracks,
      coverUrl: d.cover_xl,
    };
  }
  const d = await fetchJson<DzPlaylist>(api);
  if (d.error) throw new ResolveError("deezerApi", 404, { message: d.error.message });
  return { ...base, kind, title: d.title, artists: [], curator: d.creator?.name, trackCount: d.nb_tracks, coverUrl: d.picture_xl };
}
