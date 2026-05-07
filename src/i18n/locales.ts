export const DEFAULT_LOCALE = "sk";

export const SUPPORTED_LOCALES = ["sk", "en", "cs"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export function isSupportedLocale(locale: string): locale is SupportedLocale {
  return SUPPORTED_LOCALES.includes(locale as SupportedLocale);
}
