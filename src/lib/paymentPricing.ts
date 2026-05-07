export const RENTULO_PLATFORM_FEE_RATE = 0.12;

const EURO_FORMATTER = new Intl.NumberFormat("sk-SK", {
  style: "currency",
  currency: "EUR",
});

export type ResolveRentalAmountInput = {
  rentalAmountSnapshot?: number | string | null;
  pricePerDay?: number | string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
};

export type BuildPaymentSummaryInput = ResolveRentalAmountInput & {
  depositAmountSnapshot?: number | string | null;
  protectionFeeSnapshot?: number | string | null;
  protectionEnabled?: boolean | null;
};

export type RentalAmountSource = "snapshot" | "fallback" | "missing";

export type ResolvedRentalAmount = {
  amount: number | null;
  source: RentalAmountSource;
  reservationDays: number | null;
};

export type PaymentSummary = {
  reservationDays: number | null;
  rentalAmount: number | null;
  rentalAmountSource: RentalAmountSource;
  chargeAmount: number | null;
  depositAmount: number;
  platformFee: number | null;
  protectionFee: number;
  protectionActive: boolean;
};

function roundCurrencyAmount(value: number) {
  return Math.round(value * 100) / 100;
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsedDate = new Date(Date.UTC(year, month - 1, day));

  if (
    parsedDate.getUTCFullYear() !== year ||
    parsedDate.getUTCMonth() !== month - 1 ||
    parsedDate.getUTCDate() !== day
  ) {
    return null;
  }

  return parsedDate.getTime();
}

export function normalizeMoneyAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }

  return roundCurrencyAmount(parsed);
}

export function formatCurrencyAmount(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return EURO_FORMATTER.format(value);
}

export function calculateReservationDays(dateFrom: string | null | undefined, dateTo: string | null | undefined) {
  const fromUtc = parseDateOnly(dateFrom);
  const toUtc = parseDateOnly(dateTo);

  if (fromUtc === null || toUtc === null) {
    return null;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((toUtc - fromUtc) / msPerDay) + 1;

  return diff > 0 ? diff : null;
}

export function calculateRentalAmountFallback(
  pricePerDay: number | string | null | undefined,
  dateFrom: string | null | undefined,
  dateTo: string | null | undefined
) {
  const normalizedPricePerDay = normalizeMoneyAmount(pricePerDay);
  const reservationDays = calculateReservationDays(dateFrom, dateTo);

  if (normalizedPricePerDay === null || reservationDays === null) {
    return null;
  }

  return roundCurrencyAmount(normalizedPricePerDay * reservationDays);
}

export function resolveRentalAmount({
  rentalAmountSnapshot,
  pricePerDay,
  dateFrom,
  dateTo,
}: ResolveRentalAmountInput): ResolvedRentalAmount {
  const reservationDays = calculateReservationDays(dateFrom, dateTo);
  const normalizedSnapshot = normalizeMoneyAmount(rentalAmountSnapshot);

  if (normalizedSnapshot !== null) {
    return {
      amount: normalizedSnapshot,
      source: "snapshot",
      reservationDays,
    };
  }

  const fallbackAmount = calculateRentalAmountFallback(pricePerDay, dateFrom, dateTo);

  if (fallbackAmount !== null) {
    return {
      amount: fallbackAmount,
      source: "fallback",
      reservationDays,
    };
  }

  return {
    amount: null,
    source: "missing",
    reservationDays,
  };
}

export function calculatePlatformFee(rentalAmount: number | null | undefined) {
  const normalizedRentalAmount = normalizeMoneyAmount(rentalAmount);

  if (normalizedRentalAmount === null) {
    return null;
  }

  return roundCurrencyAmount(normalizedRentalAmount * RENTULO_PLATFORM_FEE_RATE);
}

export function resolveDepositAmount(depositAmountSnapshot: number | string | null | undefined) {
  return normalizeMoneyAmount(depositAmountSnapshot) ?? 0;
}

function resolveProtectionFee(
  protectionFeeSnapshot: number | string | null | undefined,
  protectionEnabled: boolean | null | undefined
) {
  if (protectionEnabled !== true) {
    return {
      amount: 0,
      active: false,
    };
  }

  return {
    amount: normalizeMoneyAmount(protectionFeeSnapshot) ?? 0,
    active: true,
  };
}

export function buildPaymentSummary({
  rentalAmountSnapshot,
  depositAmountSnapshot,
  protectionFeeSnapshot,
  protectionEnabled,
  pricePerDay,
  dateFrom,
  dateTo,
}: BuildPaymentSummaryInput): PaymentSummary {
  const resolvedRentalAmount = resolveRentalAmount({
    rentalAmountSnapshot,
    pricePerDay,
    dateFrom,
    dateTo,
  });
  const depositAmount = resolveDepositAmount(depositAmountSnapshot);
  const platformFee = calculatePlatformFee(resolvedRentalAmount.amount);
  const protection = resolveProtectionFee(protectionFeeSnapshot, protectionEnabled);

  return {
    reservationDays: resolvedRentalAmount.reservationDays,
    rentalAmount: resolvedRentalAmount.amount,
    rentalAmountSource: resolvedRentalAmount.source,
    chargeAmount: resolvedRentalAmount.amount,
    depositAmount,
    platformFee,
    protectionFee: protection.amount,
    protectionActive: protection.active,
  };
}
