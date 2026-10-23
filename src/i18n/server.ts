import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, type Locale, isLocale, matchAcceptLanguage } from "./config";
import { type Dictionary, getDictionary } from "./index";

/** Cookie first, then Accept-Language, then the default locale. */
export async function getRequestLocale(): Promise<Locale> {
  const stored = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(stored)) return stored;
  return matchAcceptLanguage((await headers()).get("accept-language"));
}

export async function getRequestDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getRequestLocale();
  return { locale, t: getDictionary(locale) };
}
