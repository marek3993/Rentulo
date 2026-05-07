import type { SupportedLocale } from "@/i18n/locales";
import { cs } from "./cs";
import { en } from "./en";
import { sk } from "./sk";

export type AppDictionary = {
  footer: {
    sections: {
      brand: {
        title: string;
        links: {
          home: string;
          offers: string;
        };
      };
      users: {
        title: string;
        links: {
          howItWorks: string;
          verification: string;
          messages: string;
        };
      };
      popularCategories: {
        title: string;
      };
      legal: {
        title: string;
        links: {
          terms: string;
          privacy: string;
          disputes: string;
        };
      };
      contact: {
        title: string;
        links: {
          contact: string;
          verifiedProfile: string;
          notifications: string;
        };
      };
    };
    seo: {
      rentalAcrossSlovakiaTitle: string;
      rentalAcrossSlovakiaBody: string;
      rentalByCityTitle: string;
      cityCategoryCombinationsTitle: string;
    };
    copyright: string;
  };
};

export const dictionaries: Record<SupportedLocale, AppDictionary> = {
  sk,
  en,
  cs,
};

export { cs, en, sk };
