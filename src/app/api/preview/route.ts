import { NextRequest } from "next/server";
import sharp from "sharp";
import { coverFromBuffer } from "@/lib/cover";
import { localeFromRequest } from "@/i18n/request";
import { isCardTheme } from "@/lib/palette";
import { renderCard } from "@/lib/render";
import type { MediaInfo, MediaKind } from "@/lib/types";

export const runtime = "nodejs";

/**
 * Development only: render a card from sample data and a generated cover,
 * without calling any music service. /api/preview?kind=track|album|playlist&long=1
 */
const SAMPLES: Record<MediaKind, MediaInfo> = {
  track: {
    kind: "track",
    title: "Night Swimming Lessons",
    artists: ["Halcyon Static", "Mira Vell"],
    coverUrl: "",
    source: "spotify",
    sourceName: "Spotify",
    url: "",
  },
  album: {
    kind: "album",
    title: "Square Waves, Quiet Rooms",
    artists: ["The Lantern Choir"],
    trackCount: 11,
    coverUrl: "",
    source: "youtube-music",
    sourceName: "YouTube Music",
    url: "",
  },
  playlist: {
    kind: "playlist",
    title: "Sunday Slow Burn",
    artists: [],
    curator: "Juno Park",
    trackCount: 48,
    coverUrl: "",
    source: "apple-music",
    sourceName: "Apple Music",
    url: "",
  },
};

const COVERS: Record<MediaKind, string> = {
  track: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#6B3FA0"/><circle cx="300" cy="360" r="250" fill="#F2894B"/><circle cx="300" cy="360" r="170" fill="#F6E7D0"/><circle cx="300" cy="360" r="90" fill="#6B3FA0"/><rect y="420" width="600" height="180" fill="#2B1E3A"/></svg>`,
  album: `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#13283A"/><rect x="120" y="120" width="360" height="360" fill="#7FC4D8"/><rect x="180" y="180" width="240" height="240" fill="#F6E7D0"/><rect x="240" y="240" width="120" height="120" fill="#F2894B"/></svg>`,
  playlist: `<svg xmlns="http://www.w3.org/2000/svg" width="560" height="560"><rect width="560" height="560" fill="#1C2B22"/><rect width="280" height="280" fill="#E8B04B"/><circle cx="420" cy="140" r="110" fill="#F3EFE7"/><path d="M0 560 L280 280 L280 560 Z" fill="#D9663B"/><rect x="320" y="320" width="200" height="200" fill="#7FB89A"/></svg>`,
};

export async function GET(req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("Not found", { status: 404 });
  const kind = (req.nextUrl.searchParams.get("kind") ?? "track") as MediaKind;
  if (!(kind in SAMPLES)) return new Response("Unknown kind", { status: 400 });

  const info = { ...SAMPLES[kind] };
  if (req.nextUrl.searchParams.get("long")) {
    info.title = "An Unreasonably Long Title That Needs More Than Two Lines To Fit On The Card At All";
    info.artists = info.artists.length ? ["First Artist", "Second Artist", "Third Artist", "Fourth Artist Name"] : [];
    if (info.curator) info.curator = "A Very Long Curator Name Here";
  }
  const png = await sharp(Buffer.from(COVERS[kind])).png().toBuffer();
  const cover = await coverFromBuffer(png);
  const themeParam = req.nextUrl.searchParams.get("theme");
  return renderCard(info, {
    domain: "trackshare.example",
    locale: localeFromRequest(req),
    theme: isCardTheme(themeParam) ? themeParam : "auto",
    verified: req.nextUrl.searchParams.get("verified") !== "0",
    cover,
  });
}
