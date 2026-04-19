type SearchParamsLike = Pick<URLSearchParams, "get">;

export const DEFAULT_ITEM_RADIUS_KM = "20";
export const ALL_ITEMS_CATEGORY = "Všetky kategórie";

export type ItemSearchState = {
  textQuery: string;
  locationQuery: string;
  radiusKm: string;
  category: string;
  dateFrom: string;
  dateTo: string;
  selectedLabel: string;
  lat: number | null;
  lng: number | null;
};

function cleanParam(value: string | null) {
  return value?.trim() ?? "";
}

function parseCoordinate(value: string | null) {
  if (!value) return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseItemSearchParams(searchParams: SearchParamsLike): ItemSearchState {
  return {
    textQuery: cleanParam(searchParams.get("q")),
    locationQuery: cleanParam(searchParams.get("location")),
    radiusKm: cleanParam(searchParams.get("radius")) || DEFAULT_ITEM_RADIUS_KM,
    category: cleanParam(searchParams.get("category")) || ALL_ITEMS_CATEGORY,
    dateFrom: cleanParam(searchParams.get("date_from")),
    dateTo: cleanParam(searchParams.get("date_to")),
    selectedLabel: cleanParam(searchParams.get("label")),
    lat: parseCoordinate(searchParams.get("lat")),
    lng: parseCoordinate(searchParams.get("lng")),
  };
}

export function buildItemSearchQueryString(state: ItemSearchState) {
  const params = new URLSearchParams();

  if (state.textQuery) params.set("q", state.textQuery);
  if (state.locationQuery) params.set("location", state.locationQuery);
  if (state.radiusKm && state.radiusKm !== DEFAULT_ITEM_RADIUS_KM) {
    params.set("radius", state.radiusKm);
  }
  if (state.category && state.category !== ALL_ITEMS_CATEGORY) {
    params.set("category", state.category);
  }
  if (state.dateFrom) params.set("date_from", state.dateFrom);
  if (state.dateTo) params.set("date_to", state.dateTo);
  if (state.selectedLabel) params.set("label", state.selectedLabel);
  if (state.lat !== null && state.lng !== null) {
    params.set("lat", String(state.lat));
    params.set("lng", String(state.lng));
  }

  return params.toString();
}

export function buildItemsHref(state: ItemSearchState) {
  const query = buildItemSearchQueryString(state);
  return query ? `/items?${query}` : "/items";
}

export function buildItemDetailHref(itemId: number | string, state: ItemSearchState) {
  const query = buildItemSearchQueryString(state);
  return query ? `/items/${itemId}?${query}` : `/items/${itemId}`;
}
