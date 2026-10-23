import { DEFAULT_LOCALE, type Locale } from "./config";
import { type Dictionary, type ErrorKey, en } from "./dictionaries/en";
import { es } from "./dictionaries/es";

const DICTIONARIES: Record<Locale, Dictionary> = { en, es };

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

export type TemplateParams = Record<string, string | number>;

/** Replace {name} placeholders. Unknown names are left in place. */
export function format(template: string, params: TemplateParams = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function translateError(locale: Locale, key: ErrorKey, params?: TemplateParams): string {
  return format(getDictionary(locale).errors[key], params);
}

export type { Dictionary, ErrorKey };
export { en };
