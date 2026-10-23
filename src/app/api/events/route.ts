import { after, NextRequest } from "next/server";
import { localeFromRequest } from "@/i18n/request";
import { recordEvent } from "@/lib/events";
import { isCardTheme } from "@/lib/palette";
import { resolveMedia } from "@/lib/resolve";
import { MEDIA_EVENTS, ResolveError, type MediaEventRequest } from "@/lib/types";

export const runtime = "nodejs";

const MAX_URL_LENGTH = 2048;

function parse(body: unknown): MediaEventRequest | null {
  if (!body || typeof body !== "object") return null;
  const { url, type, theme, edited } = body as Record<string, unknown>;
  if (typeof url !== "string" || !url || url.length > MAX_URL_LENGTH) return null;
  if (!(MEDIA_EVENTS as readonly unknown[]).includes(type)) return null;
  if (!isCardTheme(theme) || typeof edited !== "boolean") return null;
  return { url, type: type as MediaEventRequest["type"], theme, edited };
}

/** The first x-forwarded-for hop is the client when the host's proxy sets the header, as Vercel and most do. */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip") || "unknown";
}

/**
 * POST /api/events { url, type, theme, edited } → 202
 * Metadata is resolved again on the server, so callers cannot write titles or artists of their own.
 */
export async function POST(req: NextRequest) {
  const event = parse(await req.json().catch(() => null));
  if (!event) return new Response(null, { status: 400 });
  if (!process.env.DATABASE_URL) return new Response(null, { status: 204 });

  const details = {
    type: event.type,
    theme: event.theme,
    edited: event.edited,
    locale: localeFromRequest(req),
    ip: clientIp(req),
    at: Date.now(),
  };
  after(async () => {
    try {
      await recordEvent(await resolveMedia(event.url), details);
    } catch (err) {
      if (!(err instanceof ResolveError)) console.error("event not recorded", err);
    }
  });
  return new Response(null, { status: 202 });
}
