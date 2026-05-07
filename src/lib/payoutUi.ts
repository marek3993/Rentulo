export type RouteRecord = Record<string, unknown>;

export type PayoutStatus = "pending" | "processing" | "paid" | "failed" | "unknown";

export type ConnectReadinessState = "ready" | "pending" | "not_started";

function hasOwnProperty(record: RouteRecord, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export function asRouteRecord(value: unknown): RouteRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as RouteRecord;
}

export function asRouteRecords(value: unknown): RouteRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => asRouteRecord(entry))
    .filter((entry): entry is RouteRecord => entry !== null);
}

export function parseLooseNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, "").replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function pickString(record: RouteRecord | null | undefined, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    if (!hasOwnProperty(record, key)) {
      continue;
    }

    const value = record[key];

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

export function pickBoolean(record: RouteRecord | null | undefined, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    if (!hasOwnProperty(record, key)) {
      continue;
    }

    const value = record[key];

    if (typeof value === "boolean") {
      return value;
    }

    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();

      if (normalized === "true") {
        return true;
      }

      if (normalized === "false") {
        return false;
      }
    }
  }

  return null;
}

export function pickNumber(record: RouteRecord | null | undefined, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    if (hasOwnProperty(record, key)) {
      const directValue = parseLooseNumber(record[key]);

      if (directValue !== null) {
        return directValue;
      }
    }

    const centsKey = `${key}_cents`;

    if (hasOwnProperty(record, centsKey)) {
      const centsValue = parseLooseNumber(record[centsKey]);

      if (centsValue !== null) {
        return centsValue / 100;
      }
    }
  }

  return null;
}

export function pickIdentifier(record: RouteRecord | null | undefined, keys: string[]) {
  if (!record) {
    return null;
  }

  for (const key of keys) {
    if (!hasOwnProperty(record, key)) {
      continue;
    }

    const value = record[key];

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
}

export function formatCurrencyAmount(amount: number | null | undefined, currency = "EUR") {
  if (amount === null || amount === undefined || Number.isNaN(amount)) {
    return "—";
  }

  try {
    return new Intl.NumberFormat("sk-SK", {
      style: "currency",
      currency: /^[A-Z]{3}$/.test(currency) ? currency : "EUR",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} EUR`;
  }
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString("sk-SK");
}

export function normalizePayoutStatus(value: string | null | undefined): PayoutStatus {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "pending";
  }

  if (
    normalized === "pending" ||
    normalized === "requested" ||
    normalized === "queued" ||
    normalized === "created" ||
    normalized === "new" ||
    normalized === "submitted"
  ) {
    return "pending";
  }

  if (
    normalized === "processing" ||
    normalized === "in_progress" ||
    normalized === "in-progress" ||
    normalized === "underway"
  ) {
    return "processing";
  }

  if (
    normalized === "paid" ||
    normalized === "completed" ||
    normalized === "complete" ||
    normalized === "success" ||
    normalized === "succeeded" ||
    normalized === "sent"
  ) {
    return "paid";
  }

  if (
    normalized === "failed" ||
    normalized === "failure" ||
    normalized === "rejected" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "error"
  ) {
    return "failed";
  }

  return "unknown";
}

export function payoutStatusLabel(status: PayoutStatus) {
  if (status === "pending") return "Čaká";
  if (status === "processing") return "Spracúva sa";
  if (status === "paid") return "Vyplatené";
  if (status === "failed") return "Neúspešné";
  return "Neznáme";
}

export function payoutStatusClass(status: PayoutStatus) {
  if (status === "pending") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  if (status === "processing") return "border-sky-500/30 bg-sky-500/10 text-sky-100";
  if (status === "paid") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (status === "failed") return "border-red-500/30 bg-red-500/10 text-red-100";
  return "border-white/15 bg-white/5 text-white/70";
}

export function normalizeConnectReadiness(connect: RouteRecord | null | undefined): ConnectReadinessState {
  const payoutsEnabled = pickBoolean(connect, ["stripe_payouts_enabled"]);
  const connected =
    pickBoolean(connect, ["connected"]) ??
    Boolean(pickString(connect, ["stripe_connect_account_id"]));
  const onboardingStatus = pickString(connect, ["stripe_connect_onboarding_status"])?.toLowerCase();
  const detailsSubmitted = pickBoolean(connect, ["stripe_connect_details_submitted"]);

  if (payoutsEnabled) {
    return "ready";
  }

  if (connected || detailsSubmitted || onboardingStatus === "pending" || onboardingStatus === "completed") {
    return "pending";
  }

  return "not_started";
}

export function connectReadinessLabel(state: ConnectReadinessState) {
  if (state === "ready") return "Pripravené";
  if (state === "pending") return "Čaká na dokončenie";
  return "Nezačaté";
}

export function connectReadinessClass(state: ConnectReadinessState) {
  if (state === "ready") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (state === "pending") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-white/15 bg-white/5 text-white/70";
}

export function toInputAmount(value: number) {
  return value.toFixed(2).replace(/\.00$/, "");
}
