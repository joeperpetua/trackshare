import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, type Locale, isLocale, matchAcceptLanguage } from "./config";

/** ?lang= first, then the cookie, then Accept-Language. */
export function localeFromRequest(req: NextRequest): Locale {
  const param = req.nextUrl.searchParams.get("lang");
  if (isLocale(param)) return param;
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  return matchAcceptLanguage(req.headers.get("accept-language"));
}
