"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ItemPreviewImage from "@/components/items/ItemPreviewImage";
import ItemsResultsMap from "@/components/items/ItemsResultsMap";
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

type StatusTone = "neutral" | "success" | "error";

type LocationFeedback = {
  tone: StatusTone;
  message: string;
};

type OutsideRadiusHint = {
  nearestDistanceKm: number;
  suggestedRadiusKm: string;
  matchingCount: number;
};

const RADIUS_OPTIONS_KM = [5, 10, 15, 20, 50] as const;
const MAX_RADIUS_OPTION_KM = RADIUS_OPTIONS_KM[RADIUS_OPTIONS_KM.length - 1];
const APPROXIMATE_LOCATION_DECIMALS = 2;

function formatDistanceLabel(distanceKm: number) {
  if (!Number.isFinite(distanceKm)) {
    return "";
  }

  if (distanceKm < 10) {
    const rounded = Math.round(distanceKm * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
  }

  return `${Math.round(distanceKm)} km`;
}

function matchesClientSideFilters(item: Item, normalizedText: string, categoryFilter: string) {
  if (categoryFilter !== "V?etky kateg?rie" && item.category !== categoryFilter) {
    return false;
  }

  if (!normalizedText) {
    return true;
  }

  const haystack = [
    item.title,
    item.description ?? "",
    item.city ?? "",
    item.postal_code ?? "",
    item.category ?? "",
  ]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedText);
}

function getSuggestedRadiusKm(currentRadiusKm: number, requiredDistanceKm: number) {
  const nextRadius = RADIUS_OPTIONS_KM.find(
    (option) => option > currentRadiusKm && option >= requiredDistanceKm
  );

  return nextRadius ? String(nextRadius) : null;
}

function roundCoordinateForPrivacy(value: number) {
  const factor = 10 ** APPROXIMATE_LOCATION_DECIMALS;
  return Math.round(value * factor) / factor;
}

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="rentulo-items-eyebrow inline-flex rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em]">
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
  const [statusTone, setStatusTone] = useState<StatusTone>("neutral");
  const [status, setStatus] = useState("Načítavam...");

  const [textQuery, setTextQuery] = useState(() => initialSearchState.textQuery);
  const [locationQuery, setLocationQuery] = useState(() => initialSearchState.locationQuery);
  const [radiusKm, setRadiusKm] = useState(() => initialSearchState.radiusKm);
  const [categoryFilter, setCategoryFilter] = useState("Všetky kategórie");
  const [dateFrom, setDateFrom] = useState(() => initialSearchState.dateFrom);
  const [dateTo, setDateTo] = useState(() => initialSearchState.dateTo);

  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationResults, setLocationResults] = useState<GeoapifyFeature[]>([]);
  const [locationFeedback, setLocationFeedback] = useState<LocationFeedback | null>(null);
  const [selectedLabel, setSelectedLabel] = useState(() => initialSearchState.selectedLabel);
  const [searchCenter, setSearchCenter] = useState<SearchCenter | null>(() =>
    initialSearchState.lat !== null && initialSearchState.lng !== null
      ? { lat: initialSearchState.lat, lng: initialSearchState.lng }
      : null
  );
  const [filtersReady, setFiltersReady] = useState(false);
  const [isItemsLoading, setIsItemsLoading] = useState(false);
  const [isLocatingUser, setIsLocatingUser] = useState(false);
  const [outsideRadiusHint, setOutsideRadiusHint] = useState<OutsideRadiusHint | null>(null);

  const [unavailableItemIds, setUnavailableItemIds] = useState<number[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const itemsRequestIdRef = useRef(0);
  const outsideHintRequestIdRef = useRef(0);

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
  const normalizedTextQuery = useMemo(() => textQuery.trim().toLowerCase(), [textQuery]);
  const currentRadiusKm = Number(radiusKm);
  const isNearbySearch = selectedLabel.toLowerCase() === "moja poloha";
  const hintDistanceReference = isNearbySearch ? "od teba" : "od zvolenej lokality";
  const selectedLabelBadge = isNearbySearch ? "tvoje okolie (priblizne)" : selectedLabel;

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

  const loadImages = useCallback(async (rows: Item[], requestId: number) => {
    const ids = rows.map((x) => x.id);

    if (ids.length === 0) {
      if (itemsRequestIdRef.current !== requestId) {
        return;
      }

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

    if (itemsRequestIdRef.current !== requestId) {
      return;
    }

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
  }, []);

  const loadDefaultItems = useCallback(async () => {
    const requestId = ++itemsRequestIdRef.current;
    setIsItemsLoading(true);
    setStatusTone("neutral");
    setStatus("Na??tavam...");
    setOutsideRadiusHint(null);

    const { data, error } = await supabase
      .from("items")
      .select("id,title,description,price_per_day,city,postal_code,category,is_active")
      .eq("is_active", true)
      .order("id", { ascending: false });

    if (itemsRequestIdRef.current !== requestId) {
      return;
    }

    if (error) {
      setItems([]);
      setImageMap({});
      setActiveImageIndexMap({});
      setStatusTone("error");
      setStatus("Chyba: " + error.message);
      setIsItemsLoading(false);
      return;
    }

    const rows = ((data ?? []) as Item[]).map((x) => ({ ...x, distance_km: null }));
    setItems(rows);
    await loadImages(rows, requestId);

    if (itemsRequestIdRef.current !== requestId) {
      return;
    }

    setStatus("");
    setIsItemsLoading(false);
  }, [loadImages]);

  const loadNearbyItems = useCallback(async (lat: number, lng: number) => {
    const requestId = ++itemsRequestIdRef.current;
    setIsItemsLoading(true);
    setStatusTone("neutral");
    setStatus("H?ad?m ponuky v okol?...");
    setOutsideRadiusHint(null);

    const { data, error } = await supabase.rpc("search_items_near", {
      search_lat: lat,
      search_lng: lng,
      radius_km: Number(radiusKm),
    });

    if (itemsRequestIdRef.current !== requestId) {
      return;
    }

    if (error) {
      setItems([]);
      setImageMap({});
      setActiveImageIndexMap({});
      setStatusTone("error");
      setStatus("Chyba: " + error.message);
      setIsItemsLoading(false);
      return;
    }

    const rows = (data ?? []) as Item[];
    setItems(rows);
    await loadImages(rows, requestId);

    if (itemsRequestIdRef.current !== requestId) {
      return;
    }

    setStatus("");
    setIsItemsLoading(false);
  }, [loadImages, radiusKm]);

  useEffect(() => {
    if (searchCenter) {
      void loadNearbyItems(searchCenter.lat, searchCenter.lng);
      return;
    }

    void loadDefaultItems();
  }, [searchCenter, loadDefaultItems, loadNearbyItems]);

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

  useEffect(() => {
    if (
      !searchCenter ||
      !Number.isFinite(currentRadiusKm) ||
      currentRadiusKm >= MAX_RADIUS_OPTION_KM ||
      isItemsLoading ||
      statusTone === "error" ||
      availabilityLoading ||
      filteredItems.length > 0
    ) {
      setOutsideRadiusHint(null);
      return;
    }

    let cancelled = false;
    const requestId = ++outsideHintRequestIdRef.current;

    const loadOutsideRadiusHint = async () => {
      const { data, error } = await supabase.rpc("search_items_near", {
        search_lat: searchCenter.lat,
        search_lng: searchCenter.lng,
        radius_km: MAX_RADIUS_OPTION_KM,
      });

      if (cancelled || outsideHintRequestIdRef.current !== requestId) {
        return;
      }

      if (error) {
        setOutsideRadiusHint(null);
        return;
      }

      const widerRows = ((data ?? []) as Item[])
        .filter(
          (item) =>
            typeof item.distance_km === "number" &&
            item.distance_km > currentRadiusKm &&
            matchesClientSideFilters(item, normalizedTextQuery, categoryFilter)
        )
        .sort((a, b) => {
          const aDistance =
            typeof a.distance_km === "number" ? a.distance_km : Number.POSITIVE_INFINITY;
          const bDistance =
            typeof b.distance_km === "number" ? b.distance_km : Number.POSITIVE_INFINITY;
          return aDistance - bDistance;
        });

      if (widerRows.length === 0) {
        setOutsideRadiusHint(null);
        return;
      }

      let blockedIds = new Set<number>();

      if (hasValidDateRange) {
        const { data: blockedRows, error: blockedError } = await supabase
          .from("item_unavailable_ranges")
          .select("item_id,date_from,date_to")
          .in(
            "item_id",
            widerRows.map((item) => item.id)
          )
          .lte("date_from", dateTo)
          .gte("date_to", dateFrom);

        if (cancelled || outsideHintRequestIdRef.current !== requestId) {
          return;
        }

        if (blockedError) {
          setOutsideRadiusHint(null);
          return;
        }

        blockedIds = new Set(
          ((blockedRows ?? []) as UnavailableRangeRow[]).map((range) => range.item_id)
        );
      }

      const availableRows = widerRows.filter((item) => !blockedIds.has(item.id));
      const nearestItem = availableRows[0];

      if (!nearestItem || typeof nearestItem.distance_km !== "number") {
        setOutsideRadiusHint(null);
        return;
      }

      const suggestedRadiusKm = getSuggestedRadiusKm(currentRadiusKm, nearestItem.distance_km);

      if (!suggestedRadiusKm) {
        setOutsideRadiusHint(null);
        return;
      }

      const matchingCount = availableRows.filter(
        (item) =>
          typeof item.distance_km === "number" && item.distance_km <= Number(suggestedRadiusKm)
      ).length;

      setOutsideRadiusHint({
        nearestDistanceKm: nearestItem.distance_km,
        suggestedRadiusKm,
        matchingCount,
      });
    };

    void loadOutsideRadiusHint();

    return () => {
      cancelled = true;
    };
  }, [
    availabilityLoading,
    categoryFilter,
    currentRadiusKm,
    dateFrom,
    dateTo,
    filteredItems.length,
    hasValidDateRange,
    isItemsLoading,
    normalizedTextQuery,
    searchCenter,
    statusTone,
  ]);

  const runSearchFromFeature = async (feature: GeoapifyFeature) => {
    const p = feature.properties ?? {};
    const lat = typeof p.lat === "number" ? p.lat : null;
    const lng = typeof p.lon === "number" ? p.lon : null;
    const label = p.formatted ?? [p.city, p.postcode].filter(Boolean).join(", ");

    if (lat === null || lng === null) {
      setStatusTone("error");
      setStatus("Chyba: lokalita nema suradnice.");
      return;
    }

    setLocationFeedback(null);
    setLocationQuery(label);
    setSelectedLabel(label);
    setSearchCenter({ lat, lng });
    setLocationResults([]);
  };

  const searchByTypedLocation = async () => {
    if (searchCenter) {
      await loadNearbyItems(searchCenter.lat, searchCenter.lng);
      return;
    }

    if (locationResults.length === 0) {
      setStatusTone("error");
      setStatus("Najprv vyber lokalitu zo zoznamu návrhov.");
      return;
    }

    await runSearchFromFeature(locationResults[0]);
  };

  const useMyLocation = async () => {
    if (!navigator.geolocation) {
      setLocationFeedback({
        tone: "error",
        message: "Tento prehliadac nepodporuje polohu. Zadaj mesto alebo PSC rucne.",
      });
      setStatus("");
      return;
    }

    setIsLocatingUser(true);
    setLocationFeedback({
      tone: "neutral",
      message: "Pytame si pristup k polohe. Po povoleni pouzijeme iba pribliznu polohu v tvojom okoli.",
    });
    setStatus("");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = roundCoordinateForPrivacy(pos.coords.latitude);
        const lng = roundCoordinateForPrivacy(pos.coords.longitude);
        setIsLocatingUser(false);
        setLocationFeedback({
          tone: "success",
          message: "Pouzivame len pribliznu polohu v okoli teba. Presne GPS suradnice neukladame ani verejne nezobrazujeme.",
        });
        setLocationQuery("moja poloha");
        setSelectedLabel("moja poloha");
        setSearchCenter({ lat, lng });
        setLocationResults([]);
      },
      (error) => {
        setIsLocatingUser(false);
        setStatus("");

        if (error.code === error.PERMISSION_DENIED) {
          setLocationFeedback({
            tone: "error",
            message: "Pristup k polohe je zablokovany. Povol ho v prehliadaci alebo zadaj mesto rucne.",
          });
          return;
        }

        if (error.code === error.TIMEOUT) {
          setLocationFeedback({
            tone: "error",
            message: "Ziskanie polohy trvalo prilis dlho. Skus to este raz alebo zadaj mesto rucne.",
          });
          return;
        }

        setLocationFeedback({
          tone: "error",
          message: "Polohu sa nepodarilo zistit. Skus to znova alebo zadaj mesto rucne.",
        });
      },
      {
        enableHighAccuracy: false,
        maximumAge: 300000,
        timeout: 10000,
      }
    );
  };

  const resetSearch = async () => {
    setTextQuery("");
    setLocationQuery("");
    setLocationResults([]);
    setRadiusKm("20");
    setCategoryFilter("V?etky kateg?rie");
    setDateFrom("");
    setDateTo("");
    setLocationFeedback(null);
    setSelectedLabel("");
    setSearchCenter(null);
    setUnavailableItemIds([]);
    setOutsideRadiusHint(null);
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
      <section className="rentulo-items-hero relative overflow-hidden rounded-[2rem] px-6 py-8 md:px-8 md:py-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.12),transparent_26%),radial-gradient(circle_at_bottom_right,rgba(99,102,241,0.18),transparent_28%)]" />

        <div className="relative grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
          <div className="space-y-6">
            <SectionEyebrow>Objav ponuky na Rentulo</SectionEyebrow>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.02] tracking-tight text-foreground md:text-5xl lg:text-6xl">
                Prenájom vecí s dôrazom na fotky, dostupnosť a dôveru
              </h1>
              <p className="max-w-2xl text-base leading-7 text-text-muted md:text-lg md:leading-8">
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
                className="rentulo-btn-secondary inline-flex items-center px-5 py-3 text-sm"
              >
                Pozrieť výsledky
              </a>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rentulo-card-2 rounded-[1.6rem] p-5 backdrop-blur-sm sm:col-span-2">
              <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">
                Aktuálny výber
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div>
                  <div className="text-3xl font-semibold text-foreground">{filteredItems.length}</div>
                  <div className="mt-1 text-sm text-text-muted">zobrazených ponúk</div>
                </div>
                <div>
                  <div className="text-3xl font-semibold text-foreground">{items.length}</div>
                  <div className="mt-1 text-sm text-text-muted">načítaných ponúk</div>
                </div>
                <div>
                  <div className="text-3xl font-semibold text-foreground">{CATEGORIES.length - 1}</div>
                  <div className="mt-1 text-sm text-text-muted">hlavných kategórií</div>
                </div>
              </div>
            </div>

            <div className="rentulo-items-accent-panel-indigo rounded-[1.6rem] p-5">
              <div className="text-sm font-semibold text-foreground">Lokalita</div>
              <div className="mt-3 text-sm leading-6 text-text-muted">
                {selectedLabel ? selectedLabel : "Celé Slovensko"}
              </div>
              <div className="rentulo-items-pill mt-4 inline-flex rounded-full px-3 py-1 text-xs">
                Okruh {radiusKm} km
              </div>
            </div>

            <div className="rentulo-items-accent-panel-rose rounded-[1.6rem] p-5">
              <div className="text-sm font-semibold text-foreground">Dostupnosť</div>
              <div className="mt-3 text-sm leading-6 text-text-muted">
                {hasValidDateRange
                  ? `Filtrované medzi ${dateFrom} a ${dateTo}`
                  : "Vyber termín a zobraz len voľné ponuky"}
              </div>
              <div className="rentulo-items-pill mt-4 inline-flex rounded-full px-3 py-1 text-xs">
                Rezervácia cez Rentulo
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.24fr_0.76fr]">
        <div className="rentulo-card rounded-[2rem] p-6 shadow-[0_20px_70px_rgba(0,0,0,0.18)] md:p-8">
          <div className="flex flex-col gap-2">
            <SectionEyebrow>Filtre a lokalita</SectionEyebrow>
            <h2 className="text-2xl font-semibold text-foreground md:text-3xl">
              Spresni si výsledky bez straty kontextu
            </h2>
            <p className="max-w-2xl text-sm leading-6 text-text-muted">
              Hľadaj podľa názvu, mesta, termínu aj kategórie a rovno si over,
              ktoré ponuky ostávajú voľné.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div>
              <div className="mb-2 text-sm text-foreground/75">Čo hľadáš</div>
              <input
                className="rentulo-input-light h-12 px-3"
                placeholder="napr. vŕtačka, Kärcher, maliarske potreby"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
              />
            </div>

            <div>
              <div className="mb-2 text-sm text-foreground/75">Kategória</div>
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
              <div className="mb-2 text-sm text-foreground/75">Mesto alebo PSČ</div>
              <input
                className="rentulo-input-light h-12 px-3"
                placeholder="napr. Trnava alebo 91701"
                value={locationQuery}
                onChange={(e) => {
                  const nextValue = e.target.value;
                  setLocationQuery(nextValue);
                  setLocationResults([]);
                  setLocationFeedback(null);

                  if (selectedLabel && nextValue !== selectedLabel) {
                    setSelectedLabel("");
                    setSearchCenter(null);
                  }
                }}
              />

              {searchingLocation ? (
                <div className="mt-2 text-sm text-text-muted">Hľadám lokality...</div>
              ) : null}

              {locationResults.length > 0 ? (
                <div className="rentulo-items-dropdown mt-2 overflow-hidden rounded-[1.15rem]">
                  {locationResults.map((f, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => runSearchFromFeature(f)}
                      className="rentulo-items-dropdown-option block w-full border-b border-border px-4 py-3 text-left text-sm last:border-b-0"
                    >
                      {f.properties?.formatted ?? "Neznáma lokalita"}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-1">
                <div className="mb-2 text-sm text-foreground/75">Okruh</div>
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
                <div className="mb-2 text-sm text-foreground/75">Dátum od</div>
                <input
                  type="date"
                  className="rentulo-input-light h-12 px-3"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>

              <div className="sm:col-span-1">
                <div className="mb-2 text-sm text-foreground/75">Dátum do</div>
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
            <div className="rentulo-status rentulo-status-error mt-4 text-sm">
              Dátum od musí byť menší alebo rovný dátumu do.
            </div>
          ) : null}
        </div>

        <div className="rentulo-items-action-panel rounded-[2rem] p-6 md:p-8">
          <SectionEyebrow>Rýchle akcie</SectionEyebrow>
          <div className="mt-4 text-2xl font-semibold text-foreground">
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
              className={`rentulo-btn-secondary h-12 px-4 text-sm disabled:opacity-60 ${
                isNearbySearch ? "rentulo-btn-secondary-active" : ""
              }`}
              type="button"
              onClick={useMyLocation}
              disabled={isLocatingUser}
              aria-busy={isLocatingUser}
            >
              {isLocatingUser
                ? "Zistujem pribliznu polohu..."
                : isNearbySearch
                  ? "Aktualizovat moje okolie"
                  : "V mojej blizkosti"}
            </button>

            <button
              className="rentulo-btn-secondary h-12 px-4 text-sm"
              type="button"
              onClick={resetSearch}
            >
              Zrušiť filtre
            </button>
          </div>

          {locationFeedback ? (
            <div
              className={`mt-4 rounded-[1.25rem] border p-3 text-sm ${
                locationFeedback.tone === "error"
                  ? "rentulo-items-warning-panel"
                  : locationFeedback.tone === "success"
                    ? "rentulo-items-success-panel"
                    : "rentulo-items-note-panel"
              }`}
            >
              {locationFeedback.message}
            </div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            <div className="rentulo-items-pill rounded-full px-3 py-1">
              Výsledky: <strong className="text-foreground">{filteredItems.length}</strong>
            </div>

            {selectedLabel ? (
              <div className="rentulo-items-pill-accent rounded-full px-3 py-1">
                Lokalita: <strong className="text-foreground">{selectedLabelBadge}</strong>
              </div>
            ) : null}

            {categoryFilter !== "Všetky kategórie" ? (
              <div className="rentulo-items-pill rounded-full px-3 py-1">
                Kategória: <strong className="text-foreground">{categoryFilter}</strong>
              </div>
            ) : null}

            {hasValidDateRange ? (
              <div className="rentulo-items-pill-success rounded-full px-3 py-1">
                Voľné medzi: <strong className="text-foreground">{dateFrom}</strong> –{" "}
                <strong className="text-foreground">{dateTo}</strong>
              </div>
            ) : null}

            {availabilityLoading ? (
              <div className="rentulo-items-pill-muted rounded-full px-3 py-1">
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
                className="rentulo-items-row rounded-[1.25rem] px-4 py-4 text-sm leading-6 text-text-muted"
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>

      {status ? (
        <div
          className={`rentulo-status rounded-[1.5rem] p-4 ${
            statusTone === "error"
              ? "rentulo-status-error"
              : "rentulo-status-info"
          }`}
        >
          {status}
        </div>
      ) : null}

      {outsideRadiusHint && !status ? (
        <div className="rentulo-items-success-panel rounded-[1.75rem] p-5">
          <div className="text-base font-semibold">
            V okruhu {radiusKm} km teraz nevidime vhodnu ponuku.
          </div>
          <div className="mt-2 text-sm leading-6">
            Najblizsia zodpovedajuca ponuka je priblizne {formatDistanceLabel(outsideRadiusHint.nearestDistanceKm)} {hintDistanceReference}.{" "}
            Ak rozsiris hladanie na {outsideRadiusHint.suggestedRadiusKm} km, uvidis{" "}
            {outsideRadiusHint.matchingCount === 1
              ? "aspon 1 vhodnu ponuku"
              : `aspon ${outsideRadiusHint.matchingCount} vhodne ponuky`}.
          </div>
          <div className="mt-2 text-sm leading-6 opacity-90">
            Nadalej zobrazime iba pribliznu polohu podla verejnej lokality, nie presnu adresu.
          </div>
          <div className="mt-4">
            <button
              type="button"
              className="rentulo-btn-primary px-4 py-2 text-sm"
              onClick={() => setRadiusKm(outsideRadiusHint.suggestedRadiusKm)}
            >
              Zobrazit do {outsideRadiusHint.suggestedRadiusKm} km
            </button>
          </div>
        </div>
      ) : null}

      {filteredItems.length === 0 && !status && !outsideRadiusHint ? (
        <div className="rentulo-card rounded-[1.75rem] p-10 text-center text-text-muted">
          <div className="text-base text-foreground">
            {searchCenter
              ? isNearbySearch
                ? "V tomto okoli sa zatial nenasli ziadne ponuky."
                : "V zvolenom okoli sa zatial nenasli ziadne ponuky."
              : "Nenasli sa ziadne ponuky."}
          </div>
          <div className="mt-2 text-sm leading-6">
            Skus vacsi okruh, inu lokalitu alebo menej prisne filtre.
          </div>
        </div>
      ) : null}

      {filteredItems.length > 0 ? (
        <ItemsResultsMap
          items={filteredItems}
          searchCenter={searchCenter}
          selectedLabel={selectedLabel}
        />
      ) : null}

      <section id="vysledky" className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <SectionEyebrow>Výsledky</SectionEyebrow>
            <h2 className="mt-3 text-2xl font-semibold text-foreground md:text-3xl">
              Ponuky pripravené na objavovanie
            </h2>
          </div>
          <div className="text-sm text-text-muted">
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
              className="rentulo-card group cursor-pointer overflow-hidden rounded-[1.75rem] shadow-[0_18px_60px_rgba(0,0,0,0.18)] transition hover:-translate-y-1 hover:border-foreground/20 hover:shadow-[0_24px_80px_rgba(0,0,0,0.26)] focus:outline-none focus:ring-2 focus:ring-foreground/25 focus:ring-offset-2 focus:ring-offset-background"
              onClick={() => openItemDetail(item.id)}
              onKeyDown={(event) => handleItemCardKeyDown(event, item.id)}
              tabIndex={0}
              role="link"
              aria-label={`Otvoriť detail ponuky ${item.title}`}
            >
              <ItemPreviewImage
                src={activeImage}
                alt={item.title}
                frameClassName="rentulo-theme-preserve-dark h-64 bg-black/25"
                imageWrapperClassName="p-0"
                fit="contain"
                imageClassName="transition duration-500 group-hover:scale-[1.03]"
              >

                <div className="rentulo-image-overlay absolute inset-0" />

                <div className="absolute left-4 right-4 top-4 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {item.category ? (
                      <span className="rentulo-image-chip rounded-full px-3 py-1 text-xs font-medium">
                        {item.category}
                      </span>
                    ) : null}

                    {item.distance_km !== null && item.distance_km !== undefined ? (
                      <span className="rentulo-image-chip rounded-full px-3 py-1 text-xs font-medium text-white/80">
                        {formatDistanceLabel(item.distance_km)}
                      </span>
                    ) : null}
                  </div>

                  <span className="rentulo-image-chip rounded-full px-3 py-1 text-xs text-white/80">
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
                      className="rentulo-image-control absolute left-4 top-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-sm"
                    >
                      ←
                    </button>

                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        showNextImage(item.id);
                      }}
                      className="rentulo-image-control absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-3 py-2 text-sm"
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

                  <div className="rentulo-image-price rounded-[1.2rem] px-4 py-3 text-right">
                    <div className="text-lg font-semibold text-white">{item.price_per_day} €</div>
                    <div className="text-xs text-white/65">za deň</div>
                  </div>
                </div>
              </ItemPreviewImage>

              <div className="space-y-4 p-5">
                {item.description ? (
                  <div className="line-clamp-3 text-sm leading-6 text-text-muted">
                    {item.description}
                  </div>
                ) : (
                  <div className="text-sm text-foreground/45">Bez popisu</div>
                )}

                <div className="flex flex-wrap gap-2">
                  <span className="rentulo-items-pill rounded-full px-3 py-1 text-xs">
                    Rezervácia cez Rentulo
                  </span>
                  <span className="rentulo-items-pill rounded-full px-3 py-1 text-xs">
                    Komunikácia pri ponuke
                  </span>
                  {hasValidDateRange ? (
                    <span className="rentulo-items-pill-success rounded-full px-3 py-1 text-xs">
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
                            ? "w-8 bg-foreground"
                            : "w-2.5 bg-foreground/20 hover:bg-foreground/35"
                        }`}
                        aria-label={`Zobraziť fotku ${index + 1}`}
                      />
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <div className="text-sm text-foreground/50">
                    Fotka, cena a dôvera v jednom produkte
                  </div>

                  <Link
                    href={buildItemDetailHref(item.id, currentSearchState)}
                    className="rentulo-items-inline-action inline-flex rounded-full px-4 py-2 text-sm font-medium"
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
          <div className="rentulo-card-2 rounded-[1.5rem] p-4 text-foreground/80">
            Načítavam ponuky...
          </div>
        </main>
      }
    >
      <ItemsPageInner />
    </Suspense>
  );
}
