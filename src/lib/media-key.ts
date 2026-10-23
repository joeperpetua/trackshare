import { parseYouTubeUrl } from "./resolvers/youtube";
import type { MediaInfo } from "./types";

/**
 * Stable identity for one item on one service, so the same song shared through
 * different links (tracking params, regional paths, short links) counts once.
 * Falls back to the URL without its query when the service has no known ID shape.
 */
export function mediaKey(info: MediaInfo): string {
  const url = new URL(info.url);
  const segs = url.pathname.split("/").filter(Boolean);

  switch (info.source) {
    case "spotify": {
      const m = url.pathname.match(/\/(track|album|playlist)\/([A-Za-z0-9]{10,40})/);
      if (m) return `spotify:${m[1]}:${m[2]}`;
      break;
    }
    case "youtube":
    case "youtube-music": {
      const { videoId, listId } = parseYouTubeUrl(url);
      if (info.kind === "track" && videoId) return `youtube:video:${videoId}`;
      if (listId) return `youtube:list:${listId}`;
      break;
    }
    case "apple-music": {
      const type = segs.find((s) => ["album", "song", "playlist"].includes(s));
      const id = url.searchParams.get("i") ?? segs[segs.length - 1];
      if (type && id) return `apple-music:${info.kind}:${id}`;
      break;
    }
    case "deezer": {
      const m = url.pathname.match(/\/(track|album|playlist)\/(\d+)/);
      if (m) return `deezer:${m[1]}:${m[2]}`;
      break;
    }
  }
  const path = url.pathname.replace(/\/+$/, "");
  return `${info.source}:${info.kind}:${url.hostname.toLowerCase()}${path}`;
}

/** Bracketed or dashed suffixes that name the same recording: "(feat. X)", "[Remastered 2011]", "- Radio Edit". */
const SAME_RECORDING =
  /\b(feat|ft|featuring|with|remaster(ed)?|\d{4} remaster|official|video|audio|lyrics?|visuali[sz]er|explicit|clean|radio edit|single version|album version|mono|stereo|hd|hq|4k|deluxe( edition)?|expanded( edition)?)\b/i;

function normalize(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function baseTitle(title: string): string {
  return title
    .replace(/\s*[([]([^)\]]*)[)\]]/g, (whole, inner: string) => (SAME_RECORDING.test(inner) ? " " : whole))
    .replace(/\s+[-–—]\s+(.*)$/, (whole, tail: string) => (SAME_RECORDING.test(tail) ? "" : whole))
    .replace(/\s+(feat|ft)\.?\s.*$/i, "");
}

/** First credited artist: "A feat. B", "A & B", "A, B" and "A x B" all become "a". */
function leadArtist(artists: string[]): string {
  const first = (artists[0] ?? "").split(/\s+(?:feat\.?|ft\.?|featuring|x|&|and|with)\s+|,/i)[0];
  return normalize(first);
}

/**
 * Identity across services, from the names alone: the same song on Spotify, Apple Music and
 * YouTube shares one key, so popularity adds up. Playlists are personal, so they keep their link
 * identity, as does anything without an artist, where a bare title such as "Intro" would collide.
 */
export function matchKey(info: MediaInfo): string {
  if (info.kind === "playlist") return mediaKey(info);
  const title = normalize(baseTitle(info.title));
  const artist = leadArtist(info.artists);
  if (!title || !artist) return mediaKey(info);
  return `${info.kind}:${artist}:${title}`;
}
