import type { SourceId } from "./types";

interface SourceDef {
  id: SourceId;
  name: string;
  match: (host: string) => boolean;
}

const is = (...hosts: string[]) => (h: string) => hosts.includes(h);
const endsWith = (suffix: string) => (h: string) => h === suffix || h.endsWith(`.${suffix}`);

const SOURCES: SourceDef[] = [
  { id: "spotify", name: "Spotify", match: is("open.spotify.com", "play.spotify.com", "spotify.link", "spotify.app.link") },
  { id: "youtube-music", name: "YouTube Music", match: is("music.youtube.com") },
  { id: "youtube", name: "YouTube", match: is("youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be") },
  { id: "apple-music", name: "Apple Music", match: is("music.apple.com", "geo.music.apple.com", "itunes.apple.com") },
  { id: "deezer", name: "Deezer", match: is("deezer.com", "www.deezer.com", "link.deezer.com", "deezer.page.link") },
  { id: "soundcloud", name: "SoundCloud", match: is("soundcloud.com", "m.soundcloud.com", "on.soundcloud.com") },
  { id: "tidal", name: "TIDAL", match: is("tidal.com", "listen.tidal.com", "www.tidal.com") },
  { id: "amazon-music", name: "Amazon Music", match: (h) => /^music\.amazon\.[a-z.]+$/.test(h) },
  { id: "bandcamp", name: "Bandcamp", match: endsWith("bandcamp.com") },
];

export function detectSource(host: string): { id: SourceId; name: string } | null {
  const h = host.toLowerCase();
  const def = SOURCES.find((s) => s.match(h));
  return def ? { id: def.id, name: def.name } : null;
}

export function isSupportedHost(host: string): boolean {
  return detectSource(host) !== null;
}

export const SUPPORTED_SERVICES = SOURCES.map((s) => s.name);

/** Hosts that only redirect to the real page. */
export const SHORT_LINK_HOSTS = new Set([
  "spotify.link",
  "spotify.app.link",
  "link.deezer.com",
  "deezer.page.link",
  "on.soundcloud.com",
  "geo.music.apple.com",
]);
