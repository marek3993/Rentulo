import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/auth-js";
import { NextResponse, type NextRequest } from "next/server";

import {
  STRIPE_CONNECT_PROFILE_SELECT,
  getDefaultStripeConnectProfileState,
  normalizeStripeConnectOnboardingStatus,
  type StripeConnectProfileState,
} from "@/lib/stripe";

type AuthenticatedPaymentContext =
  | {
      ok: true;
      supabase: SupabaseClient;
      user: User;
    }
  | {
      ok: false;
      response: NextResponse;
    };

type ConnectProfileRow = {
  id?: string;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_status: string | null;
  stripe_payouts_enabled: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
};

type RpcArgs = Record<string, unknown>;

type RpcVariant = {
  args: RpcArgs;
  label: string;
};

type JsonSafe =
  | null
  | string
  | number
  | boolean
  | JsonSafe[]
  | { [key: string]: JsonSafe };

const ACCOUNT_PROFILE_WRITE_BLOCKED_KEYS = new Set([
  "id",
  "user_id",
  "profile_id",
  "created_at",
  "updated_at",
  "stripe_connect_account_id",
  "stripe_connect_onboarding_status",
  "stripe_payouts_enabled",
  "stripe_charges_enabled",
  "stripe_connect_details_submitted",
]);

const ACCOUNT_PROFILE_RESPONSE_STRIP_KEYS = new Set([
  "stripe_connect_account_id",
  "stripe_connect_onboarding_status",
  "stripe_payouts_enabled",
  "stripe_charges_enabled",
  "stripe_connect_details_submitted",
]);

function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization")?.trim() ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

function buildAuthenticatedSupabaseClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const authorization = req.headers.get("authorization")?.trim();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: authorization
      ? {
          headers: {
            Authorization: authorization,
          },
        }
      : undefined,
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeJsonWriteValue(value: unknown): JsonSafe | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => normalizeJsonWriteValue(entry))
      .filter((entry): entry is JsonSafe => entry !== undefined);

    return normalized;
  }

  if (!isPlainObject(value)) {
    return undefined;
  }

  const result: Record<string, JsonSafe> = {};

  for (const [key, entry] of Object.entries(value)) {
    const normalized = normalizeJsonWriteValue(entry);

    if (normalized !== undefined) {
      result[key] = normalized;
    }
  }

  return result;
}

function isSensitiveFinancialFieldKey(key: string) {
  const normalized = key.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  if (normalized.includes("last4") || normalized.includes("masked")) {
    return false;
  }

  return (
    normalized.includes("iban") ||
    normalized.includes("swift") ||
    normalized.includes("routing") ||
    normalized.includes("sort_code") ||
    normalized.includes("account_number") ||
    normalized.includes("bank_account") ||
    normalized === "bic" ||
    normalized.endsWith("_bic")
  );
}

function shouldStripResponseKey(key: string) {
  return ACCOUNT_PROFILE_RESPONSE_STRIP_KEYS.has(key) || isSensitiveFinancialFieldKey(key);
}

function sanitizeJsonForResponse(value: unknown): JsonSafe | undefined {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => sanitizeJsonForResponse(entry))
      .filter((entry): entry is JsonSafe => entry !== undefined);

    return normalized;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (!isPlainObject(value)) {
    return undefined;
  }

  const result: Record<string, JsonSafe> = {};

  for (const [key, entry] of Object.entries(value)) {
    if (shouldStripResponseKey(key)) {
      continue;
    }

    const normalized = sanitizeJsonForResponse(entry);

    if (normalized !== undefined) {
      result[key] = normalized;
    }
  }

  return result;
}

function isRpcSignatureMismatch(error: { code?: string; message?: string; hint?: string }, functionName: string) {
  const message = `${error.message ?? ""} ${error.hint ?? ""}`.toLowerCase();
  const normalizedFunctionName = functionName.toLowerCase();

  return (
    error.code === "PGRST202" ||
    (message.includes(normalizedFunctionName) &&
      (message.includes("could not find the function") ||
        message.includes("schema cache") ||
        message.includes("no function matches")))
  );
}

function isOrderColumnError(error: { message?: string }, columnName: string) {
  const message = error.message?.toLowerCase() ?? "";
  return message.includes(columnName.toLowerCase()) && message.includes("column");
}

function resolveVisibleRowIdentifier(row: Record<string, unknown>) {
  const candidateKeys = ["id", "account_profile_id", "user_id", "profile_id"];

  for (const key of candidateKeys) {
    const value = row[key];

    if (typeof value === "string" || typeof value === "number") {
      return { column: key, value };
    }
  }

  return null;
}

export function buildInternalManualPayoutWorkflow() {
  return {
    mode: "internal_manual_p1",
    payoutAutomation: false,
    stripePayoutExecution: false,
    sepaExecution: false,
  };
}

export async function requireAuthenticatedPaymentUser(
  req: NextRequest
): Promise<AuthenticatedPaymentContext> {
  const supabase = buildAuthenticatedSupabaseClient(req);

  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Supabase auth client is not configured on the server.",
          reason: "supabase_auth_not_configured",
        },
        { status: 500 }
      ),
    };
  }

  const token = getBearerToken(req);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Missing bearer token." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }),
    };
  }

  return {
    ok: true,
    supabase,
    user,
  };
}

export async function readStripeConnectReadiness(
  supabase: SupabaseClient,
  userId: string
): Promise<StripeConnectProfileState> {
  const { data, error } = await supabase
    .from("profiles")
    .select(STRIPE_CONNECT_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load Stripe Connect readiness: ${error.message}`);
  }

  const row = (data ?? null) as ConnectProfileRow | null;

  if (!row) {
    return getDefaultStripeConnectProfileState();
  }

  return {
    stripe_connect_account_id: row.stripe_connect_account_id ?? null,
    stripe_connect_onboarding_status: normalizeStripeConnectOnboardingStatus(
      row.stripe_connect_onboarding_status
    ),
    stripe_payouts_enabled: row.stripe_payouts_enabled ?? false,
    stripe_charges_enabled: row.stripe_charges_enabled ?? false,
    stripe_connect_details_submitted: row.stripe_connect_details_submitted ?? false,
  };
}

export function buildStripeConnectReadinessResponse(connectProfile: StripeConnectProfileState) {
  return {
    connected: Boolean(connectProfile.stripe_connect_account_id),
    stripe_connect_account_id: connectProfile.stripe_connect_account_id,
    stripe_connect_onboarding_status: connectProfile.stripe_connect_onboarding_status,
    stripe_payouts_enabled: connectProfile.stripe_payouts_enabled,
    stripe_charges_enabled: connectProfile.stripe_charges_enabled,
    stripe_connect_details_submitted: connectProfile.stripe_connect_details_submitted,
  };
}

export async function readVisibleAccountProfile(supabase: SupabaseClient) {
  const { data, error } = await supabase.from("account_profiles").select("*").limit(2);

  if (error) {
    throw new Error(`Failed to load account profile: ${error.message}`);
  }

  const rows = (data ?? []) as Record<string, unknown>[];

  if (rows.length > 1) {
    throw new Error("Account profile returned multiple rows for the current user.");
  }

  return rows[0] ?? null;
}

export function buildAccountProfileUpdatePayload(
  body: unknown,
  existingRow: Record<string, unknown> | null
) {
  if (!isPlainObject(body)) {
    return {
      invalidFields: ["body"],
      payload: {} as Record<string, JsonSafe>,
      unknownFields: [] as string[],
    };
  }

  if (!existingRow) {
    return {
      invalidFields: [] as string[],
      payload: {} as Record<string, JsonSafe>,
      unknownFields: Object.keys(body),
    };
  }

  const payload: Record<string, JsonSafe> = {};
  const invalidFields: string[] = [];
  const unknownFields: string[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (!(key in existingRow)) {
      unknownFields.push(key);
      continue;
    }

    if (ACCOUNT_PROFILE_WRITE_BLOCKED_KEYS.has(key) || isSensitiveFinancialFieldKey(key)) {
      invalidFields.push(key);
      continue;
    }

    const normalized = normalizeJsonWriteValue(value);

    if (normalized === undefined) {
      invalidFields.push(key);
      continue;
    }

    payload[key] = normalized;
  }

  return {
    invalidFields,
    payload,
    unknownFields,
  };
}

export async function updateVisibleAccountProfile(
  supabase: SupabaseClient,
  existingRow: Record<string, unknown>,
  payload: Record<string, JsonSafe>
) {
  const identifier = resolveVisibleRowIdentifier(existingRow);

  if (!identifier) {
    throw new Error(
      "The current account_profiles row cannot be updated safely because the row identifier is unknown."
    );
  }

  const { data, error } = await supabase
    .from("account_profiles")
    .update(payload)
    .eq(identifier.column, identifier.value)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to update account profile: ${error.message}`);
  }

  return (data ?? null) as Record<string, unknown> | null;
}

export async function listTableRows(
  supabase: SupabaseClient,
  tableName: string,
  page: number,
  pageSize: number
) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const orderHints = ["created_at", "id"] as const;
  let lastError: Error | null = null;

  for (const orderColumn of [...orderHints, null] as Array<(typeof orderHints)[number] | null>) {
    let query = supabase.from(tableName).select("*", { count: "exact" }).range(from, to);

    if (orderColumn) {
      query = query.order(orderColumn, { ascending: false });
    }

    const { data, error, count } = await query;

    if (!error) {
      return {
        rows: (data ?? []) as Record<string, unknown>[],
        total: count ?? 0,
      };
    }

    if (orderColumn && isOrderColumnError(error, orderColumn)) {
      lastError = new Error(error.message);
      continue;
    }

    throw new Error(`Failed to load ${tableName}: ${error.message}`);
  }

  throw lastError ?? new Error(`Failed to load ${tableName}.`);
}

export async function callRpcWithVariants<TData = unknown>(
  supabase: SupabaseClient,
  functionName: string,
  variants: RpcVariant[]
) {
  const errors: string[] = [];

  for (const variant of variants) {
    const { data, error } = await supabase.rpc(functionName, variant.args);

    if (!error) {
      return {
        data: data as TData,
        variant: variant.label,
      };
    }

    if (isRpcSignatureMismatch(error, functionName)) {
      errors.push(`${variant.label}: ${error.message}`);
      continue;
    }

    throw new Error(error.message);
  }

  throw new Error(
    `No matching RPC signature was found for ${functionName}. Tried variants: ${errors.join(" | ")}`
  );
}

export function sanitizeRouteRecord(value: unknown) {
  const normalized = sanitizeJsonForResponse(value);
  return isPlainObject(normalized) ? normalized : null;
}

export function sanitizeRouteRecords(rows: unknown[]) {
  return rows
    .map((row) => sanitizeRouteRecord(row))
    .filter((row): row is Record<string, JsonSafe> => row !== null);
}

export function extractRecordIdentifier(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const key of ["id", "payout_request_id", "request_id"]) {
    const entry = value[key];

    if (typeof entry === "number" && Number.isFinite(entry)) {
      return entry;
    }

    if (typeof entry === "string" && entry.trim()) {
      const parsed = Number(entry);
      return Number.isFinite(parsed) ? parsed : entry;
    }
  }

  return null;
}

export async function readPayoutRequestById(
  supabase: SupabaseClient,
  identifier: number | string
) {
  const { data, error } = await supabase
    .from("payout_requests")
    .select("*")
    .eq("id", identifier)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load payout request: ${error.message}`);
  }

  return (data ?? null) as Record<string, unknown> | null;
}
