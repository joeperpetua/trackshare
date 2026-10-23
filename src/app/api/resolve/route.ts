import { NextRequest } from "next/server";
import { translateError } from "@/i18n";
import { localeFromRequest } from "@/i18n/request";
import { loadCover } from "@/lib/cover";
import { paletteFor } from "@/lib/palette";
import { resolveMedia } from "@/lib/resolve";
import { ResolveError, type ResolveResponse } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/resolve?url=<share link> → normalized metadata as JSON */
export async function GET(req: NextRequest) {
  const locale = localeFromRequest(req);
  const link = req.nextUrl.searchParams.get("url");
  if (!link) return Response.json({ error: translateError(locale, "missingUrlParam") }, { status: 400 });
  try {
    const info = await resolveMedia(link);
    const cover = await loadCover(info.coverUrl);
    const body: ResolveResponse = { info, palette: paletteFor("auto", cover) };
    return Response.json(body, { headers: { "cache-control": "public, max-age=600, s-maxage=3600" } });
  } catch (err) {
    const status = err instanceof ResolveError ? err.status : 500;
    const message =
      err instanceof ResolveError
        ? translateError(locale, err.key, err.params)
        : translateError(locale, "resolveFailed");
    if (!(err instanceof ResolveError)) console.error(err);
    return Response.json({ error: message }, { status });
  }
}
