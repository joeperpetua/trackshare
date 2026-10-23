import { assertPublicHttps, fetchHtml } from "./http";
import { canonicalUrl, parseMeta } from "./opengraph";
import { resolveAppleMusic } from "./resolvers/apple";
import { resolveDeezer } from "./resolvers/deezer";
import { resolveViaOdesli, resolveViaOpenGraph } from "./resolvers/generic";
import { resolveSoundCloud } from "./resolvers/soundcloud";
import { resolveSpotify } from "./resolvers/spotify";
import { resolveYouTube } from "./resolvers/youtube";
import { detectSource, isSupportedHost, SHORT_LINK_HOSTS, SUPPORTED_SERVICES } from "./sources";
import { MediaInfo, ResolveError } from "./types";

/** Pull the first https URL out of shared text such as "Listen to X on Spotify: https://…". */
export function extractUrl(input: string): string | null {
  const m = input.trim().match(/https:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[).,;!?]+$/, "") : null;
}

/** Follow a short link (spotify.link, on.soundcloud.com, …) to the real page. */
async function expandShortLink(url: URL): Promise<URL> {
  const { html, finalUrl } = await fetchHtml(url.toString(), { allowHost: isSupportedHost });
  let target = new URL(finalUrl);
  if (SHORT_LINK_HOSTS.has(target.hostname)) {
    // Some short-link services answer 200 with the target in the page.
    const meta = parseMeta(html);
    const candidate = meta.get("og:url") ?? canonicalUrl(html) ?? html.match(/https:\/\/open\.spotify\.com\/[^"'\s<>]+/)?.[0];
    if (candidate) target = assertPublicHttps(candidate);
  }
  if (!isSupportedHost(target.hostname)) throw new ResolveError("shortLinkUnsupported", 400);
  return target;
}

const cache = new Map<string, { at: number; value: MediaInfo }>();
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

export async function resolveMedia(input: string): Promise<MediaInfo> {
  const raw = extractUrl(input);
  if (!raw) throw new ResolveError("pasteHttpsLink", 400);

  const hit = cache.get(raw);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

  let url = assertPublicHttps(raw);
  if (!isSupportedHost(url.hostname)) {
    throw new ResolveError("serviceUnsupported", 400, { services: SUPPORTED_SERVICES.join(", ") });
  }
  if (SHORT_LINK_HOSTS.has(url.hostname.toLowerCase())) url = await expandShortLink(url);

  const source = detectSource(url.hostname)!;
  const base = { source: source.id, sourceName: source.name, url: url.toString() };

  const attempts: (() => Promise<MediaInfo>)[] = [];
  switch (source.id) {
    case "spotify":
      attempts.push(() => resolveSpotify(url, base));
      break;
    case "youtube":
    case "youtube-music":
      attempts.push(() => resolveYouTube(url, base));
      break;
    case "apple-music":
      attempts.push(() => resolveAppleMusic(url, base));
      break;
    case "deezer":
      attempts.push(() => resolveDeezer(url, base));
      break;
    case "soundcloud":
      attempts.push(() => resolveSoundCloud(url, base));
      break;
  }
  attempts.push(() => resolveViaOdesli(url, base), () => resolveViaOpenGraph(url, base));

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      const info = await attempt();
      if (!info.title || !info.coverUrl) continue;
      assertPublicHttps(info.coverUrl);
      const value: MediaInfo = { ...info, title: info.title.trim(), artists: info.artists.map((a) => a.trim()).filter(Boolean) };
      if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value!);
      cache.set(raw, { at: Date.now(), value });
      return value;
    } catch (err) {
      // Keep the first error: it comes from the service-specific resolver and explains the most.
      lastError ??= err;
    }
  }
  if (lastError instanceof ResolveError) throw lastError;
  throw new ResolveError("unreadableLink", 502);
}
