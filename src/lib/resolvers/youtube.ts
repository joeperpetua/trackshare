import { fetchJson, safeFetch } from "../http";
import { MediaInfo, ResolveError } from "../types";

type Base = Pick<MediaInfo, "source" | "sourceName" | "url">;

interface Parsed {
  videoId?: string;
  listId?: string;
}

export function parseYouTubeUrl(url: URL): Parsed {
  const host = url.hostname.toLowerCase();
  let videoId: string | undefined;
  if (host === "youtu.be") videoId = url.pathname.slice(1).split("/")[0];
  else if (url.searchParams.get("v")) videoId = url.searchParams.get("v")!;
  else videoId = url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]{11})/)?.[1];
  const listId = url.searchParams.get("list") ?? undefined;
  return {
    videoId: videoId && /^[\w-]{11}$/.test(videoId) ? videoId : undefined,
    listId: listId && /^[\w-]{10,64}$/.test(listId) ? listId : undefined,
  };
}

interface OEmbed {
  title: string;
  /** Missing on auto-generated album playlists. */
  author_name?: string;
  thumbnail_url: string;
}

const oembed = (pageUrl: string) =>
  fetchJson<OEmbed>(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(pageUrl)}`);

/** "Artist - Topic", "ArtistVEVO" → "Artist" */
export function cleanChannel(name: string): string {
  return name.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
}

const NOISE =
  /\s*[([](?:official\s*(?:music\s*)?(?:video|audio|visualizer|lyric(?:s)?\s*video)|lyrics?(?:\s*video)?|audio|visuali[sz]er|hd|4k|hq|mv|m\/v|video\s*oficial)[)\]]\s*/gi;

/** Split "Artist - Song (Official Video)" style titles. */
export function splitVideoTitle(title: string, channel: string): { title: string; artists: string[] } {
  const clean = title.replace(NOISE, " ").replace(/\s{2,}/g, " ").trim();
  const m = clean.match(/^(.+?)\s+[-–—]\s+(.+)$/);
  if (m) return { artists: splitArtists(m[1]), title: m[2].trim() };
  return { title: clean, artists: channel ? [channel] : [] };
}

function splitArtists(s: string): string[] {
  return s
    .split(/\s*(?:,|&|\bx\b|\bfeat\.?|\bft\.?)\s*/i)
    .map((a) => a.trim())
    .filter(Boolean);
}

async function bestThumbnail(videoId: string, fallback: string): Promise<string> {
  const maxres = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  try {
    const res = await safeFetch(maxres, { method: "HEAD" });
    await res.body?.cancel();
    if (res.ok) return maxres;
  } catch {
    // ignore
  }
  return fallback || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

interface PlaylistApi {
  items: {
    snippet: {
      title: string;
      channelId: string;
      channelTitle: string;
      thumbnails: Record<string, { url: string; width: number }>;
    };
    contentDetails: { itemCount: number };
  }[];
}

interface PlaylistItemsApi {
  items: { snippet: { videoOwnerChannelTitle?: string } }[];
}

/** YouTube's own channel owns every auto-generated "OLAK5uy_" album playlist. */
const AUTO_PLAYLIST_CHANNEL = "UCBR8-60-B28hp2BmDPdntcQ";

function isAutoOwner(channelId?: string, channelTitle?: string): boolean {
  return channelId === AUTO_PLAYLIST_CHANNEL || /^youtube(\s+music)?$/i.test(channelTitle ?? "");
}

const videoIdFromThumbnail = (url?: string) => url?.match(/\/vi\/([\w-]{11})\//)?.[1];

/**
 * Auto-generated album playlists report "YouTube" as the channel, so take the
 * artist from the first track instead.
 */
async function albumArtist(listId: string, apiKey?: string, thumbnailUrl?: string): Promise<string | undefined> {
  if (apiKey) {
    try {
      const d = await fetchJson<PlaylistItemsApi>(
        `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=1&playlistId=${listId}&key=${encodeURIComponent(apiKey)}`,
      );
      const owner = d.items[0]?.snippet.videoOwnerChannelTitle;
      if (owner) return cleanChannel(owner);
    } catch {
      // fall back to oEmbed
    }
  }
  try {
    let videoId = videoIdFromThumbnail(thumbnailUrl);
    videoId ??= videoIdFromThumbnail((await oembed(`https://www.youtube.com/playlist?list=${listId}`)).thumbnail_url);
    if (!videoId) return undefined;
    const video = await oembed(`https://www.youtube.com/watch?v=${videoId}`);
    return video.author_name ? cleanChannel(video.author_name) : undefined;
  } catch {
    return undefined;
  }
}

export async function resolveYouTube(url: URL, base: Base): Promise<MediaInfo> {
  const { videoId, listId } = parseYouTubeUrl(url);

  if (videoId) {
    const data = await oembed(`https://www.youtube.com/watch?v=${videoId}`);
    const channel = cleanChannel(data.author_name ?? "");
    const isTopic = /-\s*Topic$/i.test(data.author_name ?? "");
    const parsed = isTopic ? { title: data.title, artists: [channel] } : splitVideoTitle(data.title, channel);
    return {
      ...base,
      kind: "track",
      title: parsed.title,
      artists: parsed.artists,
      coverUrl: await bestThumbnail(videoId, data.thumbnail_url),
    };
  }

  if (listId) {
    // YouTube Music album playlists start with OLAK5uy_.
    const isAlbum = listId.startsWith("OLAK5uy_");
    let title: string | undefined;
    let owner: string | undefined;
    let coverUrl: string | undefined;
    let trackCount: number | undefined;
    let autoOwner = false;
    let oembedThumbnail: string | undefined;

    const key = process.env.YOUTUBE_API_KEY;
    if (key) {
      try {
        const d = await fetchJson<PlaylistApi>(
          `https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails&id=${listId}&key=${encodeURIComponent(key)}`,
        );
        const item = d.items[0];
        if (item) {
          title = item.snippet.title;
          owner = item.snippet.channelTitle;
          autoOwner = isAutoOwner(item.snippet.channelId, item.snippet.channelTitle);
          trackCount = item.contentDetails.itemCount;
          coverUrl = Object.values(item.snippet.thumbnails).sort((a, b) => b.width - a.width)[0]?.url;
        }
      } catch {
        // fall back to oEmbed
      }
    }
    if (!title || !coverUrl) {
      const data = await oembed(`https://www.youtube.com/playlist?list=${listId}`);
      title = data.title;
      owner = data.author_name;
      autoOwner = isAutoOwner(undefined, data.author_name);
      coverUrl = data.thumbnail_url;
      oembedThumbnail = data.thumbnail_url;
    }
    if (isAlbum) {
      const named = owner && !autoOwner ? cleanChannel(owner) : undefined;
      const artist = named ?? (await albumArtist(listId, key, oembedThumbnail));
      return {
        ...base,
        kind: "album",
        title: title.replace(/^Album\s*[-–]\s*/i, ""),
        artists: artist ? [artist] : [],
        trackCount,
        coverUrl,
      };
    }
    return { ...base, kind: "playlist", title, artists: [], curator: owner ? cleanChannel(owner) : undefined, trackCount, coverUrl };
  }

  throw new ResolveError("youtubeLinkKind", 400);
}
