import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";
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

const BASE_FOOTER_SECTIONS: FooterSection[] = [
  {
    title: "Rentulo",
    links: [
      { href: "/", label: "Domov" },
      { href: "/items", label: "Ponuky" },
    ],
  },
  {
    title: "Pre používateľov",
    links: [
      { href: "/items", label: "Ako prenajímať" },
      { href: "/verification", label: "Overenie profilu" },
      { href: "/messages", label: "Správy" },
    ],
  },
  {
    title: "Právne informácie",
    links: [
      { href: "/", label: "Podmienky používania" },
      { href: "/", label: "Ochrana súkromia" },
      { href: "/disputes", label: "Riešenie sporov" },
    ],
  },
  {
    title: "Kontakt a dôvera",
    links: [
      { href: "/", label: "Kontakt" },
      { href: "/verification", label: "Overený profil" },
      { href: "/notifications", label: "Centrum upozornení" },
    ],
  },
];

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
  const seoCollections = await getFooterSeoCollections();
  const footerSections: FooterSection[] = [
    BASE_FOOTER_SECTIONS[0],
    BASE_FOOTER_SECTIONS[1],
    {
      title: "Populárne kategórie",
      links: seoCollections.categoryLinks,
    },
    BASE_FOOTER_SECTIONS[2],
    BASE_FOOTER_SECTIONS[3],
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
            <h2 className="rentulo-footer-heading">Prenájom po Slovensku</h2>
            <p className="mt-4 text-sm leading-7 text-[color:var(--footer-link)]">
              Na Rentulo nájdeš veci na prenájom v rôznych mestách po Slovensku, od bežného
              náradia až po elektroniku, záhradnú techniku či športové vybavenie. Ak hľadáš
              konkrétnu kategóriu alebo mesto, rýchle odkazy nižšie ťa zavedú priamo do
              existujúceho vyhľadávania ponúk. Výsledky si potom vieš ďalej spresniť podľa
              termínu, kategórie a ďalších filtrov.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div>
              <h3 className="rentulo-footer-heading">Prenájom podľa mesta</h3>
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
              <h3 className="rentulo-footer-heading">Kombinácie mesto + kategória</h3>
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
          © {new Date().getFullYear()} Rentulo. Všetky práva vyhradené.
        </div>
      </div>
    </footer>
  );
}
