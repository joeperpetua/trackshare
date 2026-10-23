import { createHmac } from "node:crypto";
import type { Locale } from "@/i18n/config";
import { db } from "./db";
import { matchKey, mediaKey } from "./media-key";
import type { CardTheme } from "./palette";
import type { MediaEvent, MediaInfo } from "./types";

const DEDUPE_WINDOW_MS = 60 * 1000;

export interface EventDetails {
  type: MediaEvent;
  theme: CardTheme;
  edited: boolean;
  locale: Locale;
  /** Client address, used only to build the dedupe key and never stored. */
  ip: string;
  /** When the request arrived, in ms. */
  at: number;
}

/**
 * One key per address, song (across services), event type and minute, so repeats inside the window
 * count once. Keyed with a server secret: the address cannot be recovered by hashing every IPv4.
 * DATABASE_URL already is one, so there is nothing extra to configure.
 */
function dedupeKey(song: string, details: EventDetails): string {
  const window = Math.floor(details.at / DEDUPE_WINDOW_MS);
  return createHmac("sha256", process.env.DATABASE_URL ?? "")
    .update(`${details.ip}\n${song}\n${details.type}\n${window}`)
    .digest("base64url");
}

/** Store one event, refreshing the media row with what the service returns now. No-op without a database. */
export async function recordEvent(info: MediaInfo, details: EventDetails): Promise<void> {
  const sql = await db();
  if (!sql) return;
  const song = matchKey(info);
  await sql`
    with m as (
      insert into media (key, match_key, source, kind, title, artists, curator, cover_url, url)
      values (
        ${mediaKey(info)}, ${song}, ${info.source}, ${info.kind}, ${info.title},
        ${sql.array(info.artists)}::text[], ${info.curator ?? null}, ${info.coverUrl}, ${info.url}
      )
      on conflict (key) do update set
        match_key = excluded.match_key,
        title = excluded.title,
        artists = excluded.artists,
        curator = excluded.curator,
        cover_url = excluded.cover_url,
        url = excluded.url,
        last_seen = now()
      returning id
    )
    insert into media_events (media_id, type, theme, edited, locale, dedupe_key, at)
    select id, ${details.type}, ${details.theme}, ${details.edited}, ${details.locale},
      ${dedupeKey(song, details)}, ${new Date(details.at)}
    from m
    on conflict (dedupe_key) do nothing
  `;
}
