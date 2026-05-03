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
const MIN_MAP_ZOOM = 7;
const MAX_MAP_ZOOM = 11;
const SINGLE_LOCALITY_ZOOM = 11;
const SEARCH_CENTER_ONLY_ZOOM = 8;
const MAP_HORIZONTAL_PADDING = 120;
const MAP_VERTICAL_PADDING = 112;

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

function formatDistanceLabel(distanceKm: number | null) {
  if (distanceKm === null || !Number.isFinite(distanceKm)) {
    return "";
  }

  if (distanceKm < 10) {
    const rounded = Math.round(distanceKm * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded} km` : `${rounded.toFixed(1)} km`;
  }

  return `${Math.round(distanceKm)} km`;
}

function mercatorX(lng: number, zoom: number) {
  return ((lng + 180) / 360) * 256 * 2 ** zoom;
}

function mercatorY(lat: number, zoom: number) {
  const sin = Math.sin((lat * Math.PI) / 180);
  const clampedSin = Math.min(Math.max(sin, -0.9999), 0.9999);
  return (0.5 - Math.log((1 + clampedSin) / (1 - clampedSin)) / (4 * Math.PI)) * 256 * 2 ** zoom;
}

function inverseMercatorLng(x: number, zoom: number) {
  return (x / (256 * 2 ** zoom)) * 360 - 180;
}

function inverseMercatorLat(y: number, zoom: number) {
  const normalized = 0.5 - y / (256 * 2 ** zoom);
  return (360 / Math.PI) * Math.atan(Math.exp(normalized * 2 * Math.PI)) - 90;
}

function clampZoom(zoom: number) {
  return Math.max(MIN_MAP_ZOOM, Math.min(MAX_MAP_ZOOM, zoom));
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

function buildViewportFromCoords(
  coords: SearchCenter[],
  options?: {
    singlePointZoom?: number;
  }
) {
  if (coords.length === 0) {
    return {
      center: DEFAULT_MAP_CENTER,
      zoom: DEFAULT_MAP_ZOOM,
    };
  }

  if (coords.length === 1) {
    return {
      center: coords[0],
      zoom: options?.singlePointZoom ?? SINGLE_LOCALITY_ZOOM,
    };
  }

  const projected = coords.map((point) => ({
    x: mercatorX(point.lng, 0),
    y: mercatorY(point.lat, 0),
  }));

  const minX = Math.min(...projected.map((point) => point.x));
  const maxX = Math.max(...projected.map((point) => point.x));
  const minY = Math.min(...projected.map((point) => point.y));
  const maxY = Math.max(...projected.map((point) => point.y));

  const width = Math.max(maxX - minX, 0.0001);
  const height = Math.max(maxY - minY, 0.0001);
  const usableWidth = Math.max(MAP_IMAGE_WIDTH - MAP_HORIZONTAL_PADDING * 2, MAP_IMAGE_WIDTH / 3);
  const usableHeight = Math.max(MAP_IMAGE_HEIGHT - MAP_VERTICAL_PADDING * 2, MAP_IMAGE_HEIGHT / 3);
  const zoomX = Math.log2(usableWidth / width);
  const zoomY = Math.log2(usableHeight / height);
  const zoom = clampZoom(Math.floor(Math.min(zoomX, zoomY)));
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  return {
    center: {
      lat: inverseMercatorLat(centerY, 0),
      lng: inverseMercatorLng(centerX, 0),
    },
    zoom,
  };
}

type ItemsResultsMapProps = {
  items: ResultsMapItem[];
  searchCenter: SearchCenter | null;
  selectedLabel: string;
};

export default function ItemsResultsMap({
  items,
  searchCenter,
  selectedLabel,
}: ItemsResultsMapProps) {
  const geoKey = process.env.NEXT_PUBLIC_GEOAPIFY_KEY ?? "";
  const [approximateCoordsByKey, setApproximateCoordsByKey] = useState<Record<string, SearchCenter | null>>({});
  const [activeLocalityKey, setActiveLocalityKey] = useState<string>("");
  const [loadingApproximateLocations, setLoadingApproximateLocations] = useState(false);
  const isNearbySearch = selectedLabel.toLowerCase() === "moja poloha";
  const locationContextLabel = selectedLabel
    ? isNearbySearch
      ? "Tvoje okolie"
      : `Okolie ${selectedLabel}`
    : "Lokalita podla vysledkov";

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

  const approximateVisibleCoords = useMemo(
    () =>
      visibleLocalityGroups
        .map((group) => approximateCoordsByKey[group.key])
        .filter(isFiniteCoordinatePair),
    [approximateCoordsByKey, visibleLocalityGroups]
  );

  const mapViewport = useMemo(() => {
    if (approximateVisibleCoords.length === 0 && isFiniteCoordinatePair(searchCenter)) {
      return buildViewportFromCoords([searchCenter], {
        singlePointZoom: SEARCH_CENTER_ONLY_ZOOM,
      });
    }

    const viewportCoords = isFiniteCoordinatePair(searchCenter)
      ? [searchCenter, ...approximateVisibleCoords]
      : approximateVisibleCoords;

    return buildViewportFromCoords(viewportCoords);
  }, [approximateVisibleCoords, searchCenter]);

  const mapSrc = useMemo(() => {
    if (!geoKey) {
      return null;
    }

    return (
      `https://maps.geoapify.com/v1/staticmap?style=osm-carto` +
      `&width=${MAP_IMAGE_WIDTH}` +
      `&height=${MAP_IMAGE_HEIGHT}` +
      `&center=lonlat:${mapViewport.center.lng},${mapViewport.center.lat}` +
      `&zoom=${mapViewport.zoom}` +
      `&apiKey=${geoKey}`
    );
  }, [geoKey, mapViewport.center.lat, mapViewport.center.lng, mapViewport.zoom]);

  const projectedLocalities = useMemo(() => {
    const next: ProjectedLocalityGroup[] = [];

    for (const group of visibleLocalityGroups) {
      const coords = approximateCoordsByKey[group.key];

      if (!isFiniteCoordinatePair(coords)) {
        continue;
      }

      const projected = projectPointToMap(
        coords.lat,
        coords.lng,
        mapViewport.center,
        mapViewport.zoom
      );

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
  }, [approximateCoordsByKey, mapViewport.center, mapViewport.zoom, visibleLocalityGroups]);

  const searchCenterProjection = useMemo(() => {
    if (!isFiniteCoordinatePair(searchCenter)) {
      return null;
    }

    const projected = projectPointToMap(
      searchCenter.lat,
      searchCenter.lng,
      mapViewport.center,
      mapViewport.zoom
    );

    if (
      projected.leftPct < 3 ||
      projected.leftPct > 97 ||
      projected.topPct < 5 ||
      projected.topPct > 95
    ) {
      return null;
    }

    return projected;
  }, [mapViewport.center, mapViewport.zoom, searchCenter]);

  const activeLocality =
    projectedLocalities.find((group) => group.key === activeLocalityKey) ??
    visibleLocalityGroups.find((group) => group.key === activeLocalityKey) ??
    null;

  const hiddenLocalityCount = Math.max(localityGroups.length - visibleLocalityGroups.length, 0);

  return (
    <section className="rentulo-card rounded-[1.75rem] p-5 shadow-[0_18px_60px_rgba(0,0,0,0.16)] md:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <div className="text-[11px] uppercase tracking-[0.24em] text-text-muted">Mapa výsledkov</div>
          <h3 className="mt-3 text-2xl font-semibold text-foreground">Približná poloha ponúk podľa mesta a PSČ</h3>
          <p className="mt-3 text-sm leading-6 text-text-muted">
            Body na mape ukazujú iba približnú polohu podľa verejne zobrazovaného mesta a PSČ.
            Presná ulica ani presný bod ponuky sa verejne nezobrazujú.
          </p>
        </div>

        <div className="flex flex-wrap gap-2 text-sm">
          <div className="rentulo-items-pill rounded-full px-3 py-1">
            {items.length} ponúk
          </div>
          <div className="rentulo-items-pill rounded-full px-3 py-1">
            {localityGroups.length} lokalít
          </div>
          <div className="rentulo-items-pill-accent rounded-full px-3 py-1">
            {locationContextLabel}
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(19rem,0.9fr)]">
        <div className="rentulo-theme-preserve-dark rentulo-card-2 overflow-hidden rounded-[1.5rem]">
          {mapSrc ? (
            <div className="relative aspect-[3/2]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mapSrc}
                alt="Mapa približných polôh ponúk"
                className="h-full w-full object-cover"
              />

              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.1),rgba(2,6,23,0.36)_100%)]" />

              {searchCenterProjection ? (
                <div
                  className="rentulo-items-map-origin pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `${searchCenterProjection.leftPct}%`,
                    top: `${searchCenterProjection.topPct}%`,
                  }}
                >
                  <span className="rentulo-items-map-origin-dot" />
                </div>
              ) : null}

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

              {searchCenterProjection ? (
                <div className="absolute left-3 top-3 rounded-full border border-white/10 bg-black/70 px-3 py-1 text-xs text-white/85 backdrop-blur-md">
                  {isNearbySearch ? "Tvoje okolie (priblizne)" : "Stred hladania"}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex aspect-[3/2] items-center justify-center px-6 text-center text-sm leading-6 text-text-muted">
              Mapa sa zobrazí po nastavení Geoapify kľúča. Aj potom bude ukazovať len približnú
              polohu podľa mesta a PSČ.
            </div>
          )}
        </div>

        <div className="rentulo-card-2 rounded-[1.5rem] p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">Lokality vo výsledkoch</div>
            {loadingApproximateLocations ? (
              <div className="text-xs text-text-muted">Dopočítavam približné body…</div>
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
                      ? "rentulo-items-row rentulo-items-row-active"
                      : "rentulo-items-row"
                  }`}
                  onMouseEnter={() => setActiveLocalityKey(group.key)}
                  onMouseLeave={() => setActiveLocalityKey("")}
                  onFocus={() => setActiveLocalityKey(group.key)}
                  onBlur={() => setActiveLocalityKey("")}
                >
                  <div>
                    <div className="text-sm font-medium text-foreground">{group.label}</div>
                    <div className="mt-1 text-xs text-text-muted">
                      {group.nearestDistanceKm !== null
                        ? `Najblizsia ponuka priblizne ${formatDistanceLabel(group.nearestDistanceKm)}`
                        : "Približná poloha podľa verejnej lokality"}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="rentulo-items-pill rounded-full px-2.5 py-1 text-xs">
                      {group.count}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] ${
                        isMapped
                          ? "rentulo-items-pill-success"
                          : "rentulo-items-pill-muted"
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
            <div className="rentulo-items-row mt-4 rounded-[1rem] px-4 py-3 text-sm text-text-muted">
              Ďalších lokalít mimo mapového prehľadu: <strong className="text-foreground">{hiddenLocalityCount}</strong>
            </div>
          ) : null}

          {activeLocality ? (
            <div className="rentulo-items-accent-panel-indigo mt-4 rounded-[1rem] px-4 py-3 text-sm text-text-muted">
              Zvýraznená lokalita: <strong className="text-foreground">{activeLocality.label}</strong>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
