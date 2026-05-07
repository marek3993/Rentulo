import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
import { DEFAULT_LOCALE } from "@/i18n/locales";
import { getDictionary } from "@/i18n/getDictionary";
import type { AppDictionary } from "@/i18n/messages";
import {
  ALL_ITEMS_CATEGORY,
  DEFAULT_ITEM_RADIUS_KM,
  buildItemsHref,
  type ItemSearchState,
} from "@/lib/itemSearchParams";

type FooterLink = {
  href: string;
  label: string;
};

type FooterSection = {
  title: string;
  links: FooterLink[];
};

type FooterSeoCollections = {
  cityLinks: FooterLink[];
  categoryLinks: FooterLink[];
  combinationLinks: FooterLink[];
};

type FooterSeoRow = {
  city: string | null;
  category: string | null;
};

const PREFERRED_CITIES = ["Bratislava", "Košice", "Žilina", "Trnava", "Nitra", "Prešov"] as const;
const PREFERRED_CATEGORIES = [
  "Náradie",
  "Záhrada",
  "Elektronika",
  "Šport a voľný čas",
  "Auto-moto",
] as const;
const CITY_LOCATIVE_MAP: Record<(typeof PREFERRED_CITIES)[number], string> = {
  Bratislava: "Bratislave",
  Košice: "Košiciach",
  Žilina: "Žiline",
  Trnava: "Trnave",
  Nitra: "Nitre",
  Prešov: "Prešove",
};
const PREFERRED_COMBINATIONS = [
  { city: "Bratislava", category: "Náradie" },
  { city: "Košice", category: "Elektronika" },
  { city: "Žilina", category: "Šport a voľný čas" },
  { city: "Trnava", category: "Záhrada" },
  { city: "Nitra", category: "Auto-moto" },
] as const satisfies ReadonlyArray<{
  city: (typeof PREFERRED_CITIES)[number];
  category: (typeof PREFERRED_CATEGORIES)[number];
}>;

const EMPTY_SEARCH_STATE: ItemSearchState = {
  textQuery: "",
  locationQuery: "",
  radiusKm: DEFAULT_ITEM_RADIUS_KM,
  category: ALL_ITEMS_CATEGORY,
  dateFrom: "",
  dateTo: "",
  selectedLabel: "",
  lat: null,
  lng: null,
};

function buildBaseFooterSections(dictionary: AppDictionary): FooterSection[] {
  const { sections } = dictionary.footer;

  return [
    {
      title: sections.brand.title,
      links: [
        { href: "/", label: sections.brand.links.home },
        { href: "/items", label: sections.brand.links.offers },
      ],
    },
    {
      title: sections.users.title,
      links: [
        { href: "/items", label: sections.users.links.howItWorks },
        { href: "/verification", label: sections.users.links.verification },
        { href: "/messages", label: sections.users.links.messages },
      ],
    },
    {
      title: sections.legal.title,
      links: [
        { href: "/", label: sections.legal.links.terms },
        { href: "/", label: sections.legal.links.privacy },
        { href: "/disputes", label: sections.legal.links.disputes },
      ],
    },
    {
      title: sections.contact.title,
      links: [
        { href: "/", label: sections.contact.links.contact },
        { href: "/verification", label: sections.contact.links.verifiedProfile },
        { href: "/notifications", label: sections.contact.links.notifications },
      ],
    },
  ];
}

function normalizeFooterValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function createItemsSearchHref({
  textQuery = "",
  category = ALL_ITEMS_CATEGORY,
}: {
  textQuery?: string;
  category?: string;
}) {
  return buildItemsHref({
    ...EMPTY_SEARCH_STATE,
    textQuery,
    category,
  });
}

function createCityLink(city: (typeof PREFERRED_CITIES)[number]): FooterLink {
  return {
    href: createItemsSearchHref({ textQuery: city }),
    label: city,
  };
}

function createCategoryLink(category: (typeof PREFERRED_CATEGORIES)[number]): FooterLink {
  return {
    href: createItemsSearchHref({ category }),
    label: category,
  };
}

function createCombinationLink(
  city: (typeof PREFERRED_CITIES)[number],
  category: (typeof PREFERRED_CATEGORIES)[number]
): FooterLink {
  const shortenedCategory = category === "Šport a voľný čas" ? "Šport" : category;

  return {
    href: createItemsSearchHref({ textQuery: city, category }),
    label: `${shortenedCategory} v ${CITY_LOCATIVE_MAP[city]}`,
  };
}

function buildFallbackSeoCollections(): FooterSeoCollections {
  return {
    cityLinks: PREFERRED_CITIES.map(createCityLink).slice(0, 6),
    categoryLinks: PREFERRED_CATEGORIES.map(createCategoryLink).slice(0, 5),
    combinationLinks: PREFERRED_COMBINATIONS.map(({ city, category }) =>
      createCombinationLink(city, category)
    ).slice(0, 4),
  };
}

function createFooterSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

const getFooterSeoCollections = unstable_cache(
  async (): Promise<FooterSeoCollections> => {
    const fallback = buildFallbackSeoCollections();
    const supabase = createFooterSupabaseClient();

    if (!supabase) {
      return fallback;
    }

    const { data, error } = await supabase
      .from("items")
      .select("city,category")
      .eq("is_active", true)
      .not("city", "is", null)
      .not("category", "is", null)
      .limit(1000);

    if (error || !data || data.length === 0) {
      return fallback;
    }

    const rows = data as FooterSeoRow[];

    const cityLinks = PREFERRED_CITIES.filter((city) => {
      const normalizedCity = normalizeFooterValue(city);
      return rows.some((row) => {
        const rowCity = row.city?.trim();
        return rowCity ? normalizeFooterValue(rowCity).includes(normalizedCity) : false;
      });
    }).map(createCityLink);

    const categoryLinks = PREFERRED_CATEGORIES.filter((category) => {
      const normalizedCategory = normalizeFooterValue(category);
      return rows.some((row) => {
        const rowCategory = row.category?.trim();
        return rowCategory ? normalizeFooterValue(rowCategory) === normalizedCategory : false;
      });
    }).map(createCategoryLink);

    const combinationLinks = PREFERRED_COMBINATIONS.filter(({ city, category }) => {
      const normalizedCity = normalizeFooterValue(city);
      const normalizedCategory = normalizeFooterValue(category);

      return rows.some((row) => {
        const rowCity = row.city?.trim();
        const rowCategory = row.category?.trim();

        if (!rowCity || !rowCategory) {
          return false;
        }

        return (
          normalizeFooterValue(rowCity).includes(normalizedCity) &&
          normalizeFooterValue(rowCategory) === normalizedCategory
        );
      });
    }).map(({ city, category }) => createCombinationLink(city, category));

    return {
      cityLinks: cityLinks.length > 0 ? cityLinks.slice(0, 6) : fallback.cityLinks,
      categoryLinks: categoryLinks.length > 0 ? categoryLinks.slice(0, 5) : fallback.categoryLinks,
      combinationLinks:
        combinationLinks.length > 0 ? combinationLinks.slice(0, 4) : fallback.combinationLinks,
    };
  },
  ["app-footer-seo-links"],
  { revalidate: 3600 }
);

export default async function AppFooter() {
  const dictionary = getDictionary(DEFAULT_LOCALE);
  const seoCollections = await getFooterSeoCollections();
  const baseSections = buildBaseFooterSections(dictionary);
  const footerSections: FooterSection[] = [
    baseSections[0],
    baseSections[1],
    {
      title: dictionary.footer.sections.popularCategories.title,
      links: seoCollections.categoryLinks,
    },
    baseSections[2],
    baseSections[3],
  ];

  return (
    <footer className="rentulo-footer mt-12 border-t lg:mt-16">
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="rentulo-footer-grid">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h2 className="rentulo-footer-heading">{section.title}</h2>
              <ul className="mt-4 space-y-3">
                {section.links.map((link) => (
                  <li key={`${section.title}-${link.label}`}>
                    <Link href={link.href} className="rentulo-footer-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-8 border-t pt-8">
          <div className="max-w-4xl">
            <h2 className="rentulo-footer-heading">{dictionary.footer.seo.rentalAcrossSlovakiaTitle}</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--footer-link)]">
              {dictionary.footer.seo.rentalAcrossSlovakiaBody}
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="rentulo-footer-heading">{dictionary.footer.seo.rentalByCityTitle}</h3>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-3">
                {seoCollections.cityLinks.map((link) => (
                  <li key={`city-${link.label}`}>
                    <Link href={link.href} className="rentulo-footer-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="rentulo-footer-heading">
                {dictionary.footer.seo.cityCategoryCombinationsTitle}
              </h3>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-3">
                {seoCollections.combinationLinks.map((link) => (
                  <li key={`combo-${link.label}`}>
                    <Link href={link.href} className="rentulo-footer-link">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rentulo-footer-copy mt-8 border-t pt-5 text-sm">
          &copy; {new Date().getFullYear()} Rentulo. {dictionary.footer.copyright}
        </div>
      </div>
    </footer>
  );
}
