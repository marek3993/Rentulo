export type ItemDeliveryMode = "pickup_only" | "delivery_available";

export type ItemDeliveryOptionsDraft = {
  mode: ItemDeliveryMode;
  ratePerKm: string;
  feeCap: string;
  maxRadiusKm: string;
};

export type ItemDeliveryOptionsNormalized = {
  mode: ItemDeliveryMode;
  ratePerKm: number | null;
  feeCap: number | null;
  maxRadiusKm: number | null;
};

export type ItemDeliveryOptionsValidationResult = {
  isValid: boolean;
  errors: Partial<Record<keyof ItemDeliveryOptionsDraft, string>>;
};

export const DEFAULT_ITEM_DELIVERY_OPTIONS_DRAFT: ItemDeliveryOptionsDraft = {
  mode: "pickup_only",
  ratePerKm: "",
  feeCap: "",
  maxRadiusKm: "",
};

function normalizeNumber(value: string) {
  const trimmed = value.trim().replace(",", ".");

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

export function normalizeItemDeliveryOptionsDraft(
  draft: ItemDeliveryOptionsDraft
): ItemDeliveryOptionsNormalized {
  const ratePerKm = normalizeNumber(draft.ratePerKm);
  const feeCap = normalizeNumber(draft.feeCap);
  const maxRadiusKm = normalizeNumber(draft.maxRadiusKm);

  return {
    mode: draft.mode,
    ratePerKm: draft.mode === "delivery_available" ? ratePerKm : null,
    feeCap: draft.mode === "delivery_available" ? feeCap : null,
    maxRadiusKm: draft.mode === "delivery_available" ? maxRadiusKm : null,
  };
}

export function validateItemDeliveryOptionsDraft(
  draft: ItemDeliveryOptionsDraft
): ItemDeliveryOptionsValidationResult {
  if (draft.mode === "pickup_only") {
    return { isValid: true, errors: {} };
  }

  const normalized = normalizeItemDeliveryOptionsDraft(draft);
  const errors: ItemDeliveryOptionsValidationResult["errors"] = {};

  if (normalized.ratePerKm === null || Number.isNaN(normalized.ratePerKm) || normalized.ratePerKm < 0) {
    errors.ratePerKm = "Zadaj platnú sadzbu za 1 km.";
  }

  if (normalized.feeCap === null || Number.isNaN(normalized.feeCap) || normalized.feeCap < 0) {
    errors.feeCap = "Zadaj platný cenový strop doručenia.";
  }

  if (
    normalized.maxRadiusKm === null ||
    Number.isNaN(normalized.maxRadiusKm) ||
    normalized.maxRadiusKm <= 0
  ) {
    errors.maxRadiusKm = "Zadaj platný maximálny radius doručenia.";
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
}

export function describeItemDeliveryOptions(
  options: ItemDeliveryOptionsNormalized
) {
  if (options.mode === "pickup_only") {
    return {
      title: "Osobný odber",
      summary: "Prenajímateľ momentálne neponúka doručenie.",
      detailRows: [] as Array<{ label: string; value: string }>,
    };
  }

  return {
    title: "Doručenie dostupné",
    summary: "Doručenie sa do finálnej ceny zatiaľ nezapočítava automaticky.",
    detailRows: [
      {
        label: "Sadzba za 1 km",
        value: options.ratePerKm !== null ? `${options.ratePerKm} € / km` : "-",
      },
      {
        label: "Cenový strop",
        value: options.feeCap !== null ? `${options.feeCap} €` : "-",
      },
      {
        label: "Max. radius",
        value: options.maxRadiusKm !== null ? `${options.maxRadiusKm} km` : "-",
      },
    ],
  };
}
