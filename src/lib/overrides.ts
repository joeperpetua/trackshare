import type { MediaInfo } from "./types";

const MAX_LEN = 200;

export interface Overrides {
  title?: string;
  artists?: string[];
  curator?: string;
}

const clean = (value: string | null) => value?.replace(/\s+/g, " ").trim().slice(0, MAX_LEN) ?? "";

/** Reads the fields the editor can change. An empty value clears the field. */
export function readOverrides(params: URLSearchParams): Overrides {
  const out: Overrides = {};
  if (params.has("title")) {
    const title = clean(params.get("title"));
    if (title) out.title = title;
  }
  if (params.has("artists")) {
    out.artists = clean(params.get("artists"))
      .split(",")
      .map((a) => a.trim())
      .filter(Boolean);
  }
  if (params.has("curator")) out.curator = clean(params.get("curator")) || undefined;
  return out;
}

/** True when nothing the editor can change differs from what the service returned. */
export function matchesSource(source: MediaInfo, shown: MediaInfo): boolean {
  return (
    shown.title === source.title &&
    shown.artists.length === source.artists.length &&
    shown.artists.every((a, i) => a === source.artists[i]) &&
    (shown.curator ?? "") === (source.curator ?? "")
  );
}

export function applyOverrides(info: MediaInfo, overrides: Overrides): MediaInfo {
  return {
    ...info,
    title: overrides.title ?? info.title,
    artists: overrides.artists ?? info.artists,
    curator: "curator" in overrides ? overrides.curator : info.curator,
  };
}
