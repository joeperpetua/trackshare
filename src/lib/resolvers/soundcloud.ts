import { fetchJson } from "../http";
import { MediaInfo, ResolveError } from "../types";

type Base = Pick<MediaInfo, "source" | "sourceName" | "url">;

interface OEmbed {
  title: string;
  author_name: string;
  thumbnail_url: string;
}

export async function resolveSoundCloud(url: URL, base: Base): Promise<MediaInfo> {
  const segs = url.pathname.split("/").filter(Boolean);
  if (segs.length < 2) throw new ResolveError("soundcloudLinkKind", 400);
  const isSet = segs[1] === "sets";

  const clean = `https://soundcloud.com/${segs.join("/")}`;
  const d = await fetchJson<OEmbed>(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(clean)}`);
  // oEmbed title: "Track Name by Artist"
  const suffix = ` by ${d.author_name}`;
  const title = d.title.endsWith(suffix) ? d.title.slice(0, -suffix.length) : d.title;
  const coverUrl = d.thumbnail_url.replace(/-(t\d+x\d+|large|crop)\.(jpg|png)$/, "-t500x500.$2");

  if (isSet) {
    return { ...base, kind: "playlist", title, artists: [], curator: d.author_name, coverUrl };
  }
  return { ...base, kind: "track", title, artists: [d.author_name], coverUrl };
}
