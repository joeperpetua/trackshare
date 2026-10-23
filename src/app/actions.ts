"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale } from "@/i18n/config";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setLocale(value: string): Promise<void> {
  const locale = isLocale(value) ? value : DEFAULT_LOCALE;
  (await cookies()).set(LOCALE_COOKIE, locale, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });
  revalidatePath("/");
}
