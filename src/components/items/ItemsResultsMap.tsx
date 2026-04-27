"use client";

import { useEffect, useMemo, useState } from "react";

type ResultsMapItem = {
  id: number;
  title: string;
  city: string | null;
  postal_code?: string | null;
  distance_km?: number | null;
};

type SearchCenter = {
  lat: number;
  lng: number;
};

type GeoapifyFeature = {
  properties?: {
    lat?: number;
    lon?: number;
  };
};

type LocalityGroup = {
  key: string;
  city: string;
  postalCode: string;
  label: string;
  count: number;
  nearestDistanceKm: number | null;
};

type ProjectedLocalityGroup = LocalityGroup & {
  lat: number;
  lng: number;
  leftPct: number;
  topPct: number;
};

const MAP_IMAGE_WIDTH = 960;
const MAP_IMAGE_HEIGHT = 640;
const MAX_VISIBLE_LOCALITIES = 10;
const DEFAULT_MAP_CENTER = { lat: 48.72, lng: 19.7 };
const DEFAULT_MAP_ZOOM = 7;
const SINGLE_LOCALITY_ZOOM = 10;
const RADIUS_TO_ZOOM: Record<string, number> = {
  "5": 13,
  "10": 12,
  "15": 11,
  "20": 10,
  "50": 8,
};

function normalizeValue(value: string | null | undefined) {
  return value?.trim() ?? "";
}

function buildLocalityKey(city: string | null | undefined, postalCode: string | null | undefined) {
  const normalizedCity = normalizeValue(city);
  const normalizedPostalCode = normalizeValue(postalCode);

  if (!normalizedCity && !normalizedPostalCode) {
    return "";
  }

  return `${normalizedCity.toLowerCase()}|${normalizedPostalCode.toLowerCase()}`;
}

function buildLocalityLabel(city: string, postalCode: string) {
  if (city && postalCode) {
    return `${city}, ${postalCode}`;
  }

  return city || postalCode || "Neznáma lokalita";
}

function mercatorX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 256 * 2 ** zoom;
}

function mercatorY(lat: number, zoom: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const clampedSin = Math.min(Math.max(sin, -0.9999), 0.9999);
  return (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * 256 * 2 ** zoom;
}

function projectPointToMap(lat: number, lng: number, center: SearchCenter, zoom: number) {
  const centerX = mercatorX(center.lng, zoom);
  const centerY = mercatorY(center.lat, zoom);
  const pointX = mercatorX(lng, zoom);
  const pointY = mercatorY(lat, zoom);

  const leftPx = MAP_IMAGE_WIDTH / 2 + (pointX - centerX);
  const topPx = MAP_IMAGE_HEIGHT / 2 + (pointY - centerY);

  return {
    leftPct: (leftPx / MAP_IMAGE_WIDTH) * 100,
    topPct: (topPx / MAP_IMAGE_HEIGHT) * 100,
  };
}

function isFiniteCoordinatePair(coords: SearchCenter | null | undefined): coords is SearchCenter {
  return Boolean(
    coords &&
      Number.isFinite(coords.lat) &&
      Number.isFinite(coords.lng)
  );
}

type ItemsResultsMapProps = {
  items: ResultsMapItem[];
  searchCenter: SearchCenter | null;
  selectedLabel: string;
  radiusKm: string;
};

export default function ItemsResultsMap({
  items,
  searchCenter,
  selectedLabel,
  radiusKm,
}: ItemsResultsMapProps) {
  const geoKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? "";
  const [approximateCoordsByKey, setApproximateCoordsByKey] = useState<Record<string, SearchCenter | null>>({});
  const [activeLocalityKey, setActiveLocalityKey] = useState<string>("");
  const [loadingApproximateLocations, setLoadingApproximateLocations] = useState(false);

  const localityGroups = useMemo(() => {
    const grouped = new Map<string, LocalityGroup>();

    for (const item of items) {
      const city = normalizeValue(item.city);
      const postalCode = normalizeValue(item.postal_code);
      const key = buildLocalityKey(city, postalCode);

      if (!key) {
        continue;
      }

      const nearestDistanceKm =
        typeof item.distance_km === "number" && Number.isFinite(item.distance_km)
          ? item.distance_km
          : null;

      const existing = grouped.get(key);

      if (existing) {
        existing.count += 1;
        if (
          nearestDistanceKm !== null &&
          (existing.nearestDistanceKm === null || nearestDistanceKm < existing.nearestDistanceKm)
        ) {
          existing.nearestDistanceKm = nearestDistanceKm;
        }
        continue;
      }

      grouped.set(key, {
        key,
        city,
        postalCode,
        label: buildLocalityLabel(city, postalCode),
        count: 1,
        nearestDistanceKm,
      });
    }

    return Array.from(grouped.values()).sort((a, b) => {
      if (a.count !== b.count) {
        return b.count - a.count;
      }

      if (a.nearestDistanceKm !== null && b.nearestDistanceKm !== null && a.nearestDistanceKm !== b.nearestDistanceKm) {
        return a.nearestDistanceKm - b.nearestDistanceKm;
      }

      if (a.nearestDistanceKm !== null && b.nearestDistanceKm === null) {
        return -1;
      }

      if (a.nearestDistanceKm === null && b.nearestDistanceKm !== null) {
        return 1;
      }

      return a.label.localeCompare(b.label, "sk");
    });
  }, [items]);

  const visibleLocalityGroups = useMemo(
    () => localityGroups.slice(0, MAX_VISIBLE_LOCALITIES),
    [localityGroups]
  );

  useEffect(() => {
    if (!geoKey || visibleLocalityGroups.length === 0) {
      setLoadingApproximateLocations(false);
      return;
    }

    const groupsToLoad = visibleLocalityGroups.filter(
      (group) => approximateCoordsByKey[group.key] === undefined
    );

    if (groupsToLoad.length === 0) {
      setLoadingApproximateLocations(false);
      return;
    }

    let cancelled = false;

    const loadApproximateLocations = async () => {
      setLoadingApproximateLocations(true);

      try {
        const loadedEntries = await Promise.all(
          groupsToLoad.map(async (group) => {
            const queryText = `${group.label}, Slovensko`;
            const url =
              `https://api.geoapify.com/v1/geocode/autocomplete` +
              `?text=${encodeURIComponent(queryText)}` +
              `&lang=sk` +
              `&limit=1` +
              `&filter=countrycode:sk` +
              `&apiKey=${geoKey}`;

            try {
              const response = await fetch(url);
              const json = await response.json();
              const feature = (json?.features?.[0] ?? null) as GeoapifyFeature | null;
              const lat = feature?.properties?.lat;
              const lng = feature?.properties?.lon;

              if (typeof lat === "number" && typeof lng === "number") {
                return [group.key, { lat, lng }] as const;
              }
            } catch {
              return [group.key, null] as const;
            }

            return [group.key, null] as const;
          })
        );

        if (cancelled) {
          return;
        }

        setApproximateCoordsByKey((prev) => {
          const next = { ...prev };

          for (const [key, coords] of loadedEntries) {
            next[key] = coords;
          }

          return next;
        });
      } finally {
        if (!cancelled) {
          setLoadingApproximateLocations(false);
        }
      }
    };

    void loadApproximateLocations();

    return () => {
      cancelled = true;
    };
  }, [approximateCoordsByKey, geoKey, visibleLocalityGroups]);

  const mapCenter = useMemo(() => {
    if (searchCenter) {
      return searchCenter;
    }

    const visibleCoords = visibleLocalityGroups
      .map((group) => approximateCoordsByKey[group.key])
      .filter(isFiniteCoordinatePair);

    if (visibleCoords.length === 0) {
      return DEFAULT_MAP_CENTER;
    }

    const total = visibleCoords.reduce(
      (acc, coords) => ({
        lat: acc.lat + coords.lat,
        lng: acc.lng + coords.lng,
      }),
      { lat: 0, lng: 0 }
    );

    return {
      lat: total.lat / visibleCoords.length,
      lng: total.lng / visibleCoords.length,
    };
  }, [approximateCoordsByKey, searchCenter, visibleLocalityGroups]);

  const mapZoom = useMemo(() => {
    if (searchCenter) {
      return RADIUS_TO_ZOOM[radiusKm] ?? RADIUS_TO_ZOOM["20"];
    }

    return visibleLocalityGroups.length <= 1 ? SINGLE_LOCALITY_ZOOM : DEFAULT_MAP_ZOOM;
  }, [radiusKm, searchCenter, visibleLocalityGroups.length]);

  const mapSrc = useMemo(() => {
    if (!geoKey) {
      return null;
    }

    return (
      `https://maps.geoapify.com/v1/staticmap?style=osm-carto` +
      `&width=${MAP_IMAGE_WIDTH}` +
      `&height=${MAP_IMAGE_HEIGHT}` +
      `&center=lonlat:${mapCenter.lng},${mapCenter.lat}` +
      `&zoom=${mapZoom}` +
      `&apiKey=${geoKey}`
    );
  }, [geoKey, mapCenter.lat, mapCenter.lng, mapZoom]);

  const projectedLocalities = useMemo(() => {
    const next: ProjectedLocalityGroup[] = [];

    for (const group of visibleLocalityGroups) {
      const coords = approximateCoordsByKey[group.key];

      if (!isFiniteCoordinatePair(coords)) {
        continue;
      }

      const projected = projectPointToMap(coords.lat, coords.lng, mapCenter, mapZoom);

      if (
        projected.leftPct < 4 ||
        projected.leftPct > 96 ||
        projected.topPct < 6 ||
        projected.topPct > 94
      ) {
        continue;
      }

      next.push({
        ...group,
        lat: coords.lat,
        lng: coords.lng,
        leftPct: projected.leftPct,
        topPct: projected.topPct,
      });
    }

    return next;
  }, [approximateCoordsByKey, mapCenter, mapZoom, visibleLocalityGroups]);

  const activeLocality =
    projectedLocalities.find((group) => group.key === activeLocalityKey) ??
    visibleLocalityGroups.find((group) => group.key === activeLocalityKey) ??
    null;

  const hiddenLocalityCount = Math.max(localityGroups.length - visibleLocalityGroups.length, 0);

  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.24em] text-white/45">Mapa výsledkov</div>
          <h3 className="mt-3 text-2xl font-semibold text-white">Približná poloha ponúk podľa mesta a PSČ</h3>
          <p className="mt-3 text-sm leading-6 text-white/68">
            Body na mape ukazujú iba približnú polohu podľa verejne zobrazovaného mesta a PSČ.
            Presná ulica ani presný bod ponuky sa verejne nezobrazujú.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-white/80">
            {items.length} ponúk
          </div>
          <div className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1 text-white/80">
            {localityGroups.length} lokalít
          </div>
          <div className="rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-white/80">
            {selectedLabel ? `Okolie ${selectedLabel}` : "Lokalita podľa výsledkov"}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]">
        <div className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/25">
          {mapSrc ? (
            <div className="relative aspect-[3/2]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapSrc}
                alt="Mapa približných polôh ponúk"
                className="h-full w-full object-cover"
              />

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.1),rgba(2,6,23,0.36)_100%)]" />

              {projectedLocalities.map((group) => {
                const isActive = group.key === activeLocalityKey;

                return (
                  <button
                    key={group.key}
                    type="button"
                    className="absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${group.leftPct}%`, top: `${group.topPct}%` }}
                    onMouseEnter={() => setActiveLocalityKey(group.key)}
                    onMouseLeave={() => setActiveLocalityKey("")}
                    onFocus={() => setActiveLocalityKey(group.key)}
                    onBlur={() => setActiveLocalityKey("")}
                  >
                    <span
                      className={`flex h-11 min-w-11 items-center justify-center rounded-full border px-3 text-sm font-semibold text-white shadow-[0_12px_30px_rgba(0,0,0,0.28)] transition ${
                        isActive
                          ? "border-white/80 bg-white text-black"
                          : "border-white/30 bg-black/70 backdrop-blur-md"
                      }`}
                    >
                      {group.count}
                    </span>

                    {isActive ? (
                      <span className="absolute left-1/2 top-full mt-2 w-max max-w-[15rem] -translate-x-1/2 rounded-full border border-white/15 bg-black/80 px-3 py-1 text-xs text-white shadow-[0_14px_40px_rgba(0,0,0,0.34)]">
                        {group.label}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              <div className="absolute bottom-3 left-3 rounded-full border border-white/10 bg-black/65 px-3 py-1 text-xs text-white/75 backdrop-blur-md">
                Mapa zobrazuje len približné lokality, nie presné adresy.
              </div>
            </div>
          ) : (
            <div className="flex aspect-[3/2] items-center justify-center px-6 text-center text-sm leading-6 text-white/60">
              Mapa sa zobrazí po nastavení Geoapify kľúča. Aj potom bude ukazovať len približnú
              polohu podľa mesta a PSČ.
            </div>
          )}
        </div>

        <div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-white">Lokality vo výsledkoch</div>
            {loadingApproximateLocations ? (
              <div className="text-xs text-white/55">Dopočítavam približné body…</div>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            {visibleLocalityGroups.map((group) => {
              const isActive = group.key === activeLocalityKey;
              const isMapped = projectedLocalities.some((projectedGroup) => projectedGroup.key === group.key);

              return (
                <button
                  key={group.key}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-[1.1rem] border px-4 py-3 text-left transition ${
                    isActive
                      ? "border-white/30 bg-white/[0.09]"
                      : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                  }`}
                  onMouseEnter={() => setActiveLocalityKey(group.key)}
                  onMouseLeave={() => setActiveLocalityKey("")}
                  onFocus={() => setActiveLocalityKey(group.key)}
                  onBlur={() => setActiveLocalityKey("")}
                >
                  <div>
                    <div className="text-sm font-medium text-white">{group.label}</div>
                    <div className="mt-1 text-xs text-white/55">
                      {group.nearestDistanceKm !== null
                        ? `Najbližšia ponuka približne ${group.nearestDistanceKm} km`
                        : "Približná poloha podľa verejnej lokality"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-xs text-white/70">
                      {group.count}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${
                        isMapped
                          ? "bg-emerald-500/15 text-emerald-200"
                          : "bg-white/8 text-white/45"
                      }`}
                    >
                      {isMapped ? "na mape" : "čaká"}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {hiddenLocalityCount > 0 ? (
            <div className="mt-4 rounded-[1rem] border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
              Ďalších lokalít mimo mapového prehľadu: <strong className="text-white">{hiddenLocalityCount}</strong>
            </div>
          ) : null}

          {activeLocality ? (
            <div className="mt-4 rounded-[1rem] border border-indigo-500/20 bg-indigo-500/10 px-4 py-3 text-sm text-white/75">
              Zvýraznená lokalita: <strong className="text-white">{activeLocality.label}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
