"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  buildItemDetailHref,
  buildItemSearchQueryString,
  parseItemSearchParams,
} from "@/lib/itemSearchParams";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
  postal_code?: string | null;
  category?: string | null;
  is_active?: boolean;
  distance_km?: number | null;
};

type UnavailableRangeRow = {
  item_id: number;
  date_from: string;
  date_to: string;
};

type ItemImageRow = {
  item_id: number;
  path: string;
  is_primary: boolean | null;
  position: number | null;
  id: number;
};

type GeoapifyFeature = {
  properties?: {
    formatted?: string;
    city?: string;
    postcode?: string;
    lat?: number;
    lon?: number;
  };
};

type SearchCenter = {
  lat: number;
  lng: number;
};

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="inline-flex rounded-full border border-white/12 bg-white/[0.05] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-white/55">
      {children}
    </div>
  );
}

const CATEGORIES = [
  "Všetky kategórie",
  "Náradie",
  "Záhrada",
  "Stavebné stroje",
  "Auto-moto",
  "Elektronika",
  "Dom a dielňa",
  "Šport a voľný čas",
  "Ostatné",
];

function ItemsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSearchState = useMemo(() => parseItemSearchParams(searchParams), [searchParams]);

  const [items, setItems] = useState<Item[]>([]);
  const [imageMap, setImageMap] = useState<Record<number, string[]>>({});
  const [activeImageIndexMap, setActiveImageIndexMap] = useState<Record<number, number>>({});
  const [status, setStatus] = useState("Načítavam...");

  const [textQuery, setTextQuery] = useState(() => initialSearchState.textQuery);
  const [locationQuery, setLocationQuery] = useState(() => initialSearchState.locationQuery);
  const [radiusKm, setRadiusKm] = useState(() => initialSearchState.radiusKm);
  const [categoryFilter, setCategoryFilter] = useState("Všetky kategórie");
  const [dateFrom, setDateFrom] = useState(() => initialSearchState.dateFrom);
  const [dateTo, setDateTo] = useState(() => initialSearchState.dateTo);

  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<GeoapifyFeature[]>([]);
  const [selectedLabel, setSelectedLabel] = useState(() => initialSearchState.selectedLabel);
  const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(() =>
    initialSearchState.lat !== null && initialSearchState.lng !== null
      ? { lat: initialSearchState.lat, lng: initialSearchState.lng }
      : null
  );
  const [filtersReady, setFiltersReady] = useState(false);

  const [unavailableItemIds, setUnavailableItemIds] = useState<number[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

  const geoKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? "";

  useEffect(() => {
    setCategoryFilter(initialSearchState.category);
    setFiltersReady(true);
  }, [initialSearchState.category]);

  const hasValidDateRange = Boolean(dateFrom && dateTo && dateFrom <= dateTo);
  const hasInvalidDateRange = Boolean(dateFrom && dateTo && dateFrom > dateTo);
  const currentSearchState = useMemo(
    () => ({
      textQuery,
      locationQuery,
      radiusKm,
      category: categoryFilter,
      dateFrom,
      dateTo,
      selectedLabel,
      lat: searchCenter?.lat ?? null,
      lng: searchCenter?.lng ?? null,
    }),
    [textQuery, locationQuery, radiusKm, categoryFilter, dateFrom, dateTo, selectedLabel, searchCenter]
  );

  const filteredItems = useMemo(() => {
    const normalizedText = textQuery.trim().toLowerCase();
    const unavailableSet = new Set(unavailableItemIds);

    return items.filter((item) => {
      if (categoryFilter !== "Všetky kategórie" && item.category !== categoryFilter) {
        return false;
      }

      if (normalizedText) {
        const haystack = [
          item.title,
          item.description ?? "",
          item.city ?? "",
          item.postal_code ?? "",
          item.category ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(normalizedText)) {
          return false;
        }
      }

      if (hasValidDateRange && unavailableSet.has(item.id)) {
        return false;
      }

      return true;
    });
  }, [items, categoryFilter, textQuery, unavailableItemIds, hasValidDateRange]);

  const loadImages = async (rows: Item[]) => {
    const ids = rows.map((x) => x.id);

    if (ids.length === 0) {
      setImageMap({});
      setActiveImageIndexMap({});
      return;
    }

    const { data: imgs, error: imgErr } = await supabase
      .from("item_images")
      .select("item_id,path,is_primary,position,id")
      .in("item_id", ids)
      .order("is_primary", { ascending: false })
      .order("position", { ascending: true })
      .order("id", { ascending: true });

    if (imgErr) {
      setImageMap({});
      setActiveImageIndexMap({});
      return;
    }

    const grouped: Record<number, ItemImageRow[]> = {};
    const nextMap: Record<number, string[]> = {};
    const nextActiveMap: Record<number, number> = {};

    for (const raw of (imgs ?? []) as ItemImageRow[]) {
      if (!grouped[raw.item_id]) grouped[raw.item_id] = [];
      grouped[raw.item_id].push(raw);
    }

    for (const itemId of Object.keys(grouped)) {
      const numericItemId = Number(itemId);

      const sorted = grouped[numericItemId].sort((a, b) => {
        if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;

        const aPos = Number.isFinite(Number(a.position)) ? Number(a.position) : 999999;
        const bPos = Number.isFinite(Number(b.position)) ? Number(b.position) : 999999;
        if (aPos !== bPos) return aPos - bPos;

        return Number(a.id) - Number(b.id);
      });

      nextMap[numericItemId] = sorted.map(
        (img) => supabase.storage.from("item-images").getPublicUrl(img.path).data.publicUrl
      );
      nextActiveMap[numericItemId] = 0;
    }

    setImageMap(nextMap);
    setActiveImageIndexMap((prev) => {
      const merged: Record<number, number> = {};

      for (const row of rows) {
        const currentIndex = prev[row.id] ?? 0;
        const count = nextMap[row.id]?.length ?? 0;
        merged[row.id] = count > 0 ? Math.min(currentIndex, count - 1) : 0;
      }

      return merged;
    });
  };

  const loadDefaultItems = async () => {
    setStatus("Načítavam...");

    const { data, error } = await supabase
      .from("items")
      .select("id,title,description,price_per_day,city,postal_code,category,is_active")
      .eq("is_active", true)
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const rows = ((data ?? []) as Item[]).map((x) => ({ ...x, distance_km: null }));
    setItems(rows);
    await loadImages(rows);
    setStatus("");
  };

  const loadNearbyItems = async (lat: number, lng: number) => {
    setStatus("Hľadám ponuky v okolí...");

    const { data, error } = await supabase.rpc("search_items_near", {
      search_lat: lat,
      search_lng: lng,
      radius_km: Number(radiusKm),
    });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const rows = (data ?? []) as Item[];
    setItems(rows);
    await loadImages(rows);
    setStatus("");
  };

  useEffect(() => {
    if (searchCenter) {
      void loadNearbyItems(searchCenter.lat, searchCenter.lng);
      return;
    }

    void loadDefaultItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!filtersReady) {
      return;
    }

    const nextQuery = buildItemSearchQueryString(currentSearchState);
    const currentQuery = searchParams.toString();

    if (nextQuery === currentQuery) {
      return;
    }

    router.replace(nextQuery ? `/items?${nextQuery}` : "/items", { scroll: false });
  }, [currentSearchState, filtersReady, router, searchParams]);

  useEffect(() => {
    const q = locationQuery.trim();

    if (!geoKey || q.length < 2) {
      setLocationResults([]);
      return;
    }

    const t = setTimeout(async () => {
      try {
        setSearchingLocation(true);

        const url =
          `https://api.geoapify.com/v1/geocode/autocomplete` +
          `?text=${encodeURIComponent(q)}` +
          `&lang=sk` +
          `&limit=5` +
          `&filter=countrycode:sk` +
          `&apiKey=${geoKey}`;

        const res = await fetch(url);
        const json = await res.json();
        setLocationResults(json?.features ?? []);
      } catch {
        setLocationResults([]);
      } finally {
        setSearchingLocation(false);
      }
    }, 350);

    return () => clearTimeout(t);
  }, [locationQuery, geoKey]);

  useEffect(() => {
    const itemIds = items.map((item) => item.id);

    if (!hasValidDateRange || itemIds.length === 0) {
      setUnavailableItemIds([]);
      setAvailabilityLoading(false);
      return;
    }

    let cancelled = false;

    const loadUnavailableItems = async () => {
      setAvailabilityLoading(true);

      const { data, error } = await supabase
        .from("item_unavailable_ranges")
        .select("item_id,date_from,date_to")
        .in("item_id", itemIds)
        .lte("date_from", dateTo)
        .gte("date_to", dateFrom);

      if (cancelled) return;

      if (error) {
        setUnavailableItemIds([]);
        setAvailabilityLoading(false);
        return;
      }

      const blocked = new Set<number>();

      for (const range of (data ?? []) as UnavailableRangeRow[]) {
        blocked.add(range.item_id);
      }

      setUnavailableItemIds(Array.from(blocked));
      setAvailabilityLoading(false);
    };

    loadUnavailableItems();

    return () => {
      cancelled = true;
    };
  }, [items, dateFrom, dateTo, hasValidDateRange]);

  const runSearchFromFeature = async (feature: GeoapifyFeature) => {
    const p = feature.properties ?? {};
    const lat = typeof p.lat === "number" ? p.lat : null;
    const lng = typeof p.lon === "number" ? p.lon : null;
    const label = p.formatted ?? [p.city, p.postcode].filter(Boolean).join(", ");

    if (lat === null || lng === null) {
      setStatus("Chyba: lokalita nemá súradnice.");
      return;
    }

    setLocationQuery(label);
    setSelectedLabel(label);
    setSearchCenter({ lat, lng });
    setLocationResults([]);
    await loadNearbyItems(lat, lng);
  };

  const searchByTypedLocation = async () => {
    if (searchCenter) {
      await loadNearbyItems(searchCenter.lat, searchCenter.lng);
      return;
    }

    if (locationResults.length === 0) {
      setStatus("Najprv vyber lokalitu zo zoznamu návrhov.");
      return;
    }

    await runSearchFromFeature(locationResults[0]);
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      setStatus("Tento prehliadač nepodporuje geolokáciu.");
      return;
    }

    setStatus("Zisťujem tvoju polohu...");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setLocationQuery("moja poloha");
        setSelectedLabel("moja poloha");
        setSearchCenter({ lat, lng });
        setLocationResults([]);
        await loadNearbyItems(lat, lng);
      },
      () => {
        setStatus("Nepodarilo sa získať tvoju polohu.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      }
    );
  };

  const resetSearch = async () => {
    setTextQuery("");
    setLocationQuery("");
    setLocationResults([]);
    setRadiusKm("20");
    setCategoryFilter("Všetky kategórie");
    setDateFrom("");
    setDateTo("");
    setSelectedLabel("");
    setSearchCenter(null);
    setUnavailableItemIds([]);
    await loadDefaultItems();
  };

  const setItemImageIndex = (itemId: number, nextIndex: number) => {
    setActiveImageIndexMap((prev) => ({
      ...prev,
      [itemId]: nextIndex,
    }));
  };

  const showPrevImage = (itemId: number) => {
    const images = imageMap[itemId] ?? [];
    if (images.length <= 1) return;

    const current = activeImageIndexMap[itemId] ?? 0;
    const next = current === 0 ? images.length - 1 : current - 1;
    setItemImageIndex(itemId, next);
  };

  const showNextImage = (itemId: number) => {
    const images = imageMap[itemId] ?? [];
    if (images.length <= 1) return;

    const current = activeImageIndexMap[itemId] ?? 0;
    const next = current === images.length - 1 ? 0 : current + 1;
    setItemImageIndex(itemId, next);
  };

  const openItemDetail = (itemId: number) => {
    router.push(buildItemDetailHref(itemId, currentSearchState));
  };

  const handleItemCardKeyDown = (
    event: React.KeyboardEvent<HTMLLIElement>,
    itemId: number
  ) => {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openItemDetail(itemId);
    }
  };

  return (
    <main className="space-y-8 lg:space-y-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03)_42%,rgba(99,102,241,0.14)_100%)] px-6 py-8 shadow-[0_24px_90px_rgba(0,0,0,0.28)] md:px-8 md:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_28%)]" />

        <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-6">
            <SectionEyebrow>Objav ponuky na Rentulo</SectionEyebrow>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-white md:text-5xl lg:text-6xl">
                Prenájom vecí s dôrazom na fotky, dostupnosť a dôveru
              </h1>
              <p className="max-w-2xl text-base leading-7 text-white/72 md:text-lg md:leading-8">
                Prechádzaj ponuky podľa lokality, termínu aj typu veci. Rentulo
                drží výber, rezerváciu a komunikáciu v jednom produkte.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link className="rentulo-btn-primary px-5 py-3 text-sm" href="/items/new">
                Pridať ponuku
              </Link>
              <a
                href="#vysledky"
                className="rentulo-btn-secondary inline-flex items-center bg-white/[0.03] px-5 py-3 text-sm"
              >
                Pozrieť výsledky
              </a>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[1.6rem] border border-white/10 bg-black/25 p-5 backdrop-blur-sm sm:col-span-2">
              <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">
                Aktuálny výber
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-3xl font-semibold text-white">{filteredItems.length}</div>
                  <div className="mt-1 text-sm text-white/60">zobrazených ponúk</div>
                </div>
                <div>
                  <div className="text-3xl font-semibold text-white">{items.length}</div>
                  <div className="mt-1 text-sm text-white/60">načítaných ponúk</div>
                </div>
                <div>
                  <div className="text-3xl font-semibold text-white">{CATEGORIES.length - 1}</div>
                  <div className="mt-1 text-sm text-white/60">hlavných kategórií</div>
                </div>
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(99,102,241,0.16),rgba(0,0,0,0.16))] p-5">
              <div className="text-sm font-semibold text-white">Lokalita</div>
              <div className="mt-3 text-sm leading-6 text-white/72">
                {selectedLabel ? selectedLabel : "Celé Slovensko"}
              </div>
              <div className="mt-4 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                Okruh {radiusKm} km
              </div>
            </div>

            <div className="rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(236,72,153,0.14),rgba(0,0,0,0.16))] p-5">
              <div className="text-sm font-semibold text-white">Dostupnosť</div>
              <div className="mt-3 text-sm leading-6 text-white/72">
                {hasValidDateRange
                  ? `Filtrované medzi ${dateFrom} a ${dateTo}`
                  : "Vyber termín a zobraz len voľné ponuky"}
              </div>
              <div className="mt-4 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-white/70">
                Rezervácia cez Rentulo
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.24fr_0.76fr]">
        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.18)] md:p-8">
          <div className="flex flex-col gap-2">
            <SectionEyebrow>Filtre a lokalita</SectionEyebrow>
            <h2 className="text-2xl font-semibold text-white md:text-3xl">
              Spresni si výsledky bez straty kontextu
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-white/65">
              Hľadaj podľa názvu, mesta, termínu aj kategórie a rovno si over,
              ktoré ponuky ostávajú voľné.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm text-white/75">Čo hľadáš</div>
              <input
                className="rentulo-input-light h-12 px-3 placeholder:text-black/50"
                placeholder="napr. vŕtačka, Kärcher, Trnava"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-2 text-sm text-white/75">Kategória</div>
              <select
                className="rentulo-input-light h-12 px-3"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="mb-2 text-sm text-white/75">Mesto alebo PSČ</div>
              <input
                className="rentulo-input-light h-12 px-3 placeholder:text-black/50"
                placeholder="napr. Trnava alebo 91701"
                value={locationQuery}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setLocationQuery(nextValue);
                  setLocationResults([]);

                  if (selectedLabel && nextValue !== selectedLabel) {
                    setSelectedLabel("");
                    setSearchCenter(null);
                  }
                }}
              />

              {searchingLocation ? (
                <div className="mt-2 text-sm text-white/60">Hľadám lokality...</div>
              ) : null}

              {locationResults.length > 0 ? (
                <div className="mt-2 overflow-hidden rounded-[1.15rem] border border-white/10 bg-black/20">
                  {locationResults.map((f, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => runSearchFromFeature(f)}
                      className="block w-full border-b border-white/10 px-4 py-3 text-left text-sm text-white/85 hover:bg-white/10 last:border-b-0"
                    >
                      {f.properties?.formatted ?? "Neznáma lokalita"}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <div className="mb-2 text-sm text-white/75">Okruh</div>
                <select
                  className="rentulo-input-light h-12 px-3"
                  value={radiusKm}
                  onChange={(e) => setRadiusKm(e.target.value)}
                >
                  <option value="5">5 km</option>
                  <option value="10">10 km</option>
                  <option value="15">15 km</option>
                  <option value="20">20 km</option>
                  <option value="50">50 km</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <div className="mb-2 text-sm text-white/75">Dátum od</div>
                <input
                  type="date"
                  className="rentulo-input-light h-12 px-3"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div className="sm:col-span-1">
                <div className="mb-2 text-sm text-white/75">Dátum do</div>
                <input
                  type="date"
                  className="rentulo-input-light h-12 px-3"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>
          </div>

          {hasInvalidDateRange ? (
            <div className="mt-4 rounded-[1.25rem] border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
              Dátum od musí byť menší alebo rovný dátumu do.
            </div>
          ) : null}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(17,24,39,0.9),rgba(9,12,20,0.82))] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.22)] md:p-8">
          <SectionEyebrow>Rýchle akcie</SectionEyebrow>
          <div className="mt-4 text-2xl font-semibold text-white">
            Nastav si hľadanie podľa toho, ako chceš objavovať ponuky
          </div>

          <div className="mt-6 grid gap-3">
            <button
              className="rentulo-btn-primary h-12 px-4 text-sm"
              type="button"
              onClick={searchByTypedLocation}
            >
              Hľadať podľa lokality
            </button>

            <button
              className="rentulo-btn-secondary h-12 px-4 text-sm"
              type="button"
              onClick={useMyLocation}
            >
              V mojej blízkosti
            </button>

            <button
              className="rentulo-btn-secondary h-12 px-4 text-sm"
              type="button"
              onClick={resetSearch}
            >
              Zrušiť filtre
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/80">
              Výsledky: <strong className="text-white">{filteredItems.length}</strong>
            </div>

            {selectedLabel ? (
              <div className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-white/80">
                Lokalita: <strong className="text-white">{selectedLabel}</strong>
              </div>
            ) : null}

            {categoryFilter !== "Všetky kategórie" ? (
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/80">
                Kategória: <strong className="text-white">{categoryFilter}</strong>
              </div>
            ) : null}

            {hasValidDateRange ? (
              <div className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-white/80">
                Voľné medzi: <strong className="text-white">{dateFrom}</strong> –{" "}
                <strong className="text-white">{dateTo}</strong>
              </div>
            ) : null}

            {availabilityLoading ? (
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-white/60">
                Kontrolujem dostupnosť...
              </div>
            ) : null}
          </div>

          <div className="mt-6 space-y-3">
            {[
              "Výber podľa lokality a termínu",
              "Silnejší dôraz na fotky a cenu",
              "Rezervácia a komunikácia na jednom mieste",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1.25rem] border border-white/10 bg-white/[0.04] px-4 py-4 text-sm leading-6 text-white/72"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {status ? (
        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-white/80">
          {status}
        </div>
      ) : null}

      {filteredItems.length === 0 && !status ? (
        <div className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.02))] p-10 text-center text-white/60">
          Nenašli sa žiadne ponuky.
        </div>
      ) : null}

      <section id="vysledky" className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionEyebrow>Výsledky</SectionEyebrow>
            <h2 className="mt-3 text-2xl font-semibold text-white md:text-3xl">
              Ponuky pripravené na objavovanie
            </h2>
          </div>
          <div className="text-sm text-white/60">
            Fotka, cena, miesto a dôvera v čitateľnejšej hierarchii.
          </div>
        </div>

        <ul className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredItems.map((item) => {
          const images = imageMap[item.id] ?? [];
          const activeIndex = activeImageIndexMap[item.id] ?? 0;
          const activeImage = images[activeIndex] ?? null;

          return (
            <li
              key={item.id}
              className="group cursor-pointer overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[0_18px_60px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_24px_80px_rgba(0,0,0,0.26)] focus:outline-none focus:ring-2 focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-black"
              onClick={() => openItemDetail(item.id)}
              onKeyDown={(event) => handleItemCardKeyDown(event, item.id)}
              tabIndex={0}
              role="link"
              aria-label={`Otvoriť detail ponuky ${item.title}`}
            >
              <div className="relative h-64 overflow-hidden">
                {activeImage ? (
                  <img
                    src={activeImage}
                    alt={item.title}
                    className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-black/20 text-sm text-white/40">
                    Bez fotky
                  </div>
                )}

                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {item.category ? (
                      <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-medium text-white backdrop-blur-sm">
                        {item.category}
                      </span>
                    ) : null}

                    {item.distance_km !== null && item.distance_km !== undefined ? (
                      <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs font-medium text-white/80 backdrop-blur-sm">
                        {item.distance_km} km
                      </span>
                    ) : null}
                  </div>

                  <span className="rounded-full border border-white/10 bg-black/35 px-3 py-1 text-xs text-white/80 backdrop-blur-sm">
                    {images.length > 0 ? `${activeIndex + 1}/${images.length} fotiek` : "Bez fotiek"}
                  </span>
                </div>

                {images.length > 1 ? (
                  <>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        showPrevImage(item.id);
                      }}
                      className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-sm text-white backdrop-blur-sm hover:bg-black/65"
                    >
                      ←
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        showNextImage(item.id);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full border border-white/20 bg-black/45 px-3 py-2 text-sm text-white backdrop-blur-sm hover:bg-black/65"
                    >
                      →
                    </button>
                  </>
                ) : null}

                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3">
                  <div className="max-w-[70%]">
                    <div className="text-xl font-semibold text-white">{item.title}</div>
                    <div className="mt-1 text-sm text-white/70">
                      {item.city ? <span>{item.city}</span> : null}
                      {item.city && item.postal_code ? <span> · </span> : null}
                      {item.postal_code ? <span>{item.postal_code}</span> : null}
                    </div>
                  </div>

                  <div className="rounded-[1.2rem] border border-white/10 bg-black/40 px-4 py-3 text-right backdrop-blur-sm">
                    <div className="text-lg font-semibold text-white">{item.price_per_day} €</div>
                    <div className="text-xs text-white/65">za deň</div>
                  </div>
                </div>
              </div>

              <div className="space-y-4 p-5">
                {item.description ? (
                  <div className="line-clamp-3 text-sm leading-6 text-white/70">
                    {item.description}
                  </div>
                ) : (
                  <div className="text-sm text-white/45">Bez popisu</div>
                )}

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/72">
                    Rezervácia cez Rentulo
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-white/72">
                    Komunikácia pri ponuke
                  </span>
                  {hasValidDateRange ? (
                    <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
                      Voľné v termíne
                    </span>
                  ) : null}
                </div>

                {images.length > 1 ? (
                  <div className="flex gap-2">
                    {images.slice(0, 4).map((_, index) => (
                      <button
                        key={`${item.id}-${index}`}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setItemImageIndex(item.id, index);
                        }}
                        className={`h-2.5 rounded-full transition ${
                          activeIndex === index
                            ? "w-8 bg-white"
                            : "w-2.5 bg-white/25 hover:bg-white/45"
                        }`}
                        aria-label={`Zobraziť fotku ${index + 1}`}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="text-sm text-white/50">
                    Fotka, cena a dôvera v jednom produkte
                  </div>

                  <Link
                    href={buildItemDetailHref(item.id, currentSearchState)}
                    className="inline-flex rounded-full border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-medium text-white/85 hover:bg-white/[0.1]"
                    onClick={(event) => event.stopPropagation()}
                  >
                    Otvoriť detail
                  </Link>
                </div>
              </div>
            </li>
          );
        })}
        </ul>
      </section>
    </main>
  );
}

export default function ItemsPage() {
  return (
    <Suspense
      fallback={
        <main className="space-y-8 lg:space-y-10">
          <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-white/80">
            Načítavam ponuky...
          </div>
        </main>
      }
    >
      <ItemsPageInner />
    </Suspense>
  );
}


