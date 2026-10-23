import { NextRequest } from "next/server";
import { translateError } from "@/i18n";
import { localeFromRequest } from "@/i18n/request";
import { isCardTheme } from "@/lib/palette";
import { renderCard, slugify } from "@/lib/render";
import { resolveMedia } from "@/lib/resolve";
import { applyOverrides, matchesSource, readOverrides } from "@/lib/overrides";
import { ResolveError } from "@/lib/types";

export const runtime = "nodejs";

/** GET /api/card?url=<share link>[&theme=][&title=][&artists=][&download=1] → 1080 × 1080 PNG */
export async function GET(req: NextRequest) {
  const locale = localeFromRequest(req);
  const params = req.nextUrl.searchParams;
  const link = params.get("url");
  if (!link) return Response.json({ error: translateError(locale, "missingUrlParam") }, { status: 400 });

  const themeParam = params.get("theme");
  const theme = isCardTheme(themeParam) ? themeParam : "auto";

  try {
    const resolved = await resolveMedia(link);
    const info = applyOverrides(resolved, readOverrides(params));
    const domain = process.env.SITE_DOMAIN || req.nextUrl.host;
    const image = await renderCard(info, {
      domain,
      locale,
      theme,
      verified: matchesSource(resolved, info),
    });

    const headers = new Headers(image.headers);
    headers.set("cache-control", "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800");
    const filename = `trackshare-${slugify(`${info.artists[0] ?? info.curator ?? ""} ${info.title}`)}.png`;
    headers.set(
      "content-disposition",
      `${params.get("download") ? "attachment" : "inline"}; filename="${filename}"`,
    );
    return new Response(image.body, { status: 200, headers });
  } catch (err) {
    const status = err instanceof ResolveError ? err.status : 500;
    const message =
      err instanceof ResolveError
        ? translateError(locale, err.key, err.params)
        : translateError(locale, "cardFailed");
    if (!(err instanceof ResolveError)) console.error(err);
    return Response.json({ error: message }, { status });
  }
}
