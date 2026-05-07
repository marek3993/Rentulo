import { DEFAULT_LOCALE, isSupportedLocale } from "@/i18n/locales";
import { dictionaries, type AppDictionary } from "@/i18n/messages";

export function getDictionary(locale?: string | null): AppDictionary {
  if (locale && isSupportedLocale(locale)) {
    return dictionaries[locale];
  }

  return dictionaries[DEFAULT_LOCALE];
}
