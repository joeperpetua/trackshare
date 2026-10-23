import { type ErrorKey, type TemplateParams, en, format } from "@/i18n";
import type { CardTheme, Palette } from "./palette";

export type MediaKind = "track" | "album" | "playlist";

export type SourceId =
  | "spotify"
  | "youtube"
  | "youtube-music"
  | "apple-music"
  | "deezer"
  | "soundcloud"
  | "tidal"
  | "amazon-music"
  | "bandcamp"
  | "other";

/** Normalized metadata for one shared link. */
export interface MediaInfo {
  kind: MediaKind;
  title: string;
  /** Artists for tracks and albums. Empty for playlists. */
  artists: string[];
  /** Playlist owner or curator, when known. */
  curator?: string;
  /** Number of tracks, for albums and playlists, when known. */
  trackCount?: number;
  /** The source capped its list, so trackCount is a lower bound and shows as "100+". */
  trackCountIsMinimum?: boolean;
  /** HTTPS URL of the cover image. */
  coverUrl: string;
  source: SourceId;
  /** Display name of the source service, e.g. "Spotify". */
  sourceName: string;
  /** The link the user gave, after short-link expansion. */
  url: string;
}

/** What GET /api/resolve returns: the metadata plus the colors read from the cover. */
export interface ResolveResponse {
  info: MediaInfo;
  palette: Palette;
}

/** Moments recorded for popularity: a card was made, or it left the app. */
export const MEDIA_EVENTS = ["created", "download", "copy", "share"] as const;

export type MediaEvent = (typeof MEDIA_EVENTS)[number];

/** Body of POST /api/events. */
export interface MediaEventRequest {
  url: string;
  type: MediaEvent;
  theme: CardTheme;
  /** The title or names were changed in the editor. */
  edited: boolean;
}

/** Carries a dictionary key, so the API layer can render it in the caller's language. */
export class ResolveError extends Error {
  constructor(
    public readonly key: ErrorKey,
    public readonly status = 422,
    public readonly params: TemplateParams = {},
  ) {
    super(format(en.errors[key], params));
    this.name = "ResolveError";
  }
}
