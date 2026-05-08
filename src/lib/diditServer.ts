import { createHmac, timingSafeEqual } from "crypto";

export type DiditSessionResponse = {
  session_id: string;
  session_number?: number;
  session_token?: string;
  vendor_data?: string;
  metadata?: unknown;
  status?: string;
  workflow_id?: string;
  callback?: string;
  url?: string;
  verification_id?: string | null;
  [key: string]: unknown;
};

export type DiditWebhookPayload = {
  event_id?: string | null;
  id?: string | null;
  session_id?: string | null;
  verification_id?: string | null;
  status?: string | null;
  vendor_data?: string | null;
  webhook_type?: string | null;
  timestamp?: string | number | null;
  workflow_id?: string | null;
  metadata?: unknown;
  decision?: unknown;
  [key: string]: unknown;
};

type CreateDiditSessionInput = {
  userId: string;
  userEmail: string;
  userVerificationId: number;
  callbackUrl: string;
};

type VerifyDiditWebhookSignatureInput = {
  payload: DiditWebhookPayload;
  headers: Headers;
};

type VerifyDiditWebhookSignatureResult =
  | {
      ok: true;
      method: "x-signature-v2" | "x-signature-simple";
    }
  | {
      ok: false;
      reason: string;
    };

export type DiditWebhookCore = {
  providerEventId: string;
  providerSessionId: string;
  providerVerificationId: string | null;
  providerStatus: string;
  webhookType: string;
  vendorData: string | null;
};

const DIDIT_CREATE_SESSION_URL = "https://verification.didit.me/v3/session/";
const WEBHOOK_MAX_DRIFT_SECONDS = 300;

function getDiditApiKey() {
  return process.env.DIDIT_API_KEY?.trim() ?? "";
}

function getDiditWorkflowId() {
  return process.env.DIDIT_WORKFLOW_ID?.trim() ?? "";
}

function getDiditWebhookSecret() {
  return process.env.DIDIT_WEBHOOK_SECRET?.trim() ?? "";
}

export function assertDiditSessionConfig() {
  const apiKey = getDiditApiKey();
  const workflowId = getDiditWorkflowId();

  if (!apiKey) {
    throw new Error("DIDIT_API_KEY is not configured.");
  }

  if (!workflowId) {
    throw new Error("DIDIT_WORKFLOW_ID is not configured.");
  }

  return {
    apiKey,
    workflowId,
  };
}

function assertDiditWebhookConfig() {
  const secret = getDiditWebhookSecret();

  if (!secret) {
    throw new Error("DIDIT_WEBHOOK_SECRET is not configured.");
  }

  return {
    secret,
  };
}

function safeParseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

function getErrorMessageFromResponse(status: number, rawText: string, parsed: unknown) {
  if (parsed && typeof parsed === "object") {
    const record = parsed as Record<string, unknown>;
    const message = record.message ?? record.error ?? record.detail;

    if (typeof message === "string" && message.trim()) {
      return `Didit Create Session failed (${status}): ${message.trim()}`;
    }
  }

  const trimmedText = rawText.trim();

  if (trimmedText) {
    return `Didit Create Session failed (${status}): ${trimmedText}`;
  }

  return `Didit Create Session failed (${status}).`;
}

export async function createDiditSession({
  userId,
  userEmail,
  userVerificationId,
  callbackUrl,
}: CreateDiditSessionInput) {
  const { apiKey, workflowId } = assertDiditSessionConfig();

  const response = await fetch(DIDIT_CREATE_SESSION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      workflow_id: workflowId,
      vendor_data: userId,
      callback: callbackUrl,
      callback_method: "both",
      language: "sk",
      metadata: JSON.stringify({
        user_id: userId,
        user_verification_id: userVerificationId,
      }),
      contact_details: {
        email: userEmail,
        send_notification_emails: false,
        email_lang: "sk",
      },
    }),
  });

  const rawText = await response.text();
  const parsed = safeParseJson(rawText);

  if (!response.ok) {
    throw new Error(getErrorMessageFromResponse(response.status, rawText, parsed));
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Didit Create Session returned invalid JSON.");
  }

  const session = parsed as DiditSessionResponse;

  if (!session.session_id || typeof session.session_id !== "string") {
    throw new Error("Didit Create Session did not return session_id.");
  }

  if (!session.url || typeof session.url !== "string") {
    throw new Error("Didit Create Session did not return verification url.");
  }

  return session;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function shortenFloats(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(shortenFloats);
  }

  if (isPlainRecord(value)) {
    const next: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(value)) {
      next[key] = shortenFloats(entryValue);
    }

    return next;
  }

  if (typeof value === "number" && Number.isFinite(value) && value % 1 === 0) {
    return Math.trunc(value);
  }

  return value;
}

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }

  if (!isPlainRecord(value)) {
    return value;
  }

  const sorted: Record<string, unknown> = {};

  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortKeysDeep(value[key]);
  }

  return sorted;
}

function timingSafeEqualText(expected: string, provided: string) {
  const expectedBuffer = Buffer.from(expected, "utf8");
  const providedBuffer = Buffer.from(provided, "utf8");

  if (expectedBuffer.length !== providedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function isFreshTimestamp(timestampHeader: string | null) {
  if (!timestampHeader) return false;

  const incomingTimestamp = Number(timestampHeader);

  if (!Number.isFinite(incomingTimestamp)) {
    return false;
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - incomingTimestamp) <= WEBHOOK_MAX_DRIFT_SECONDS;
}

function hmacSha256Hex(secret: string, value: string) {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

function verifySignatureV2(
  payload: DiditWebhookPayload,
  signature: string,
  timestampHeader: string,
  secret: string
) {
  if (!isFreshTimestamp(timestampHeader)) {
    return false;
  }

  const canonicalBody = JSON.stringify(sortKeysDeep(shortenFloats(payload)));
  const expectedSignature = hmacSha256Hex(secret, canonicalBody);

  return timingSafeEqualText(expectedSignature, signature);
}

function verifySignatureSimple(
  payload: DiditWebhookPayload,
  signature: string,
  timestampHeader: string,
  secret: string
) {
  if (!isFreshTimestamp(timestampHeader)) {
    return false;
  }

  const canonicalString = [
    payload.timestamp ?? "",
    payload.session_id ?? "",
    payload.status ?? "",
    payload.webhook_type ?? "",
  ].join(":");

  const expectedSignature = hmacSha256Hex(secret, canonicalString);

  return timingSafeEqualText(expectedSignature, signature);
}

export function verifyDiditWebhookSignature({
  payload,
  headers,
}: VerifyDiditWebhookSignatureInput): VerifyDiditWebhookSignatureResult {
  const { secret } = assertDiditWebhookConfig();
  const timestampHeader = headers.get("x-timestamp");

  if (!timestampHeader) {
    return {
      ok: false,
      reason: "missing_timestamp",
    };
  }

  const signatureV2 = headers.get("x-signature-v2");

  if (signatureV2 && verifySignatureV2(payload, signatureV2, timestampHeader, secret)) {
    return {
      ok: true,
      method: "x-signature-v2",
    };
  }

  const signatureSimple = headers.get("x-signature-simple");

  if (signatureSimple && verifySignatureSimple(payload, signatureSimple, timestampHeader, secret)) {
    return {
      ok: true,
      method: "x-signature-simple",
    };
  }

  return {
    ok: false,
    reason: "invalid_signature",
  };
}

function readString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function getDiditProviderEventId(
  payload: DiditWebhookPayload,
  fallbackTimestamp: string | null
) {
  const explicitEventId = readString(payload.event_id) ?? readString(payload.id);

  if (explicitEventId) {
    return explicitEventId;
  }

  return [
    readString(payload.webhook_type) ?? "unknown_webhook",
    readString(payload.session_id) ?? "unknown_session",
    readString(payload.status) ?? "unknown_status",
    String(payload.timestamp ?? fallbackTimestamp ?? "unknown_timestamp"),
  ].join(":");
}

export function getDiditProviderVerificationId(payload: DiditWebhookPayload) {
  const directValue = readString(payload.verification_id);

  if (directValue) {
    return directValue;
  }

  const decision = payload.decision;

  if (decision && typeof decision === "object" && !Array.isArray(decision)) {
    const record = decision as Record<string, unknown>;
    return readString(record.verification_id) ?? readString(record.id);
  }

  return null;
}

export function getDiditWebhookCore(
  payload: DiditWebhookPayload,
  fallbackTimestamp: string | null
): DiditWebhookCore {
  const providerSessionId = readString(payload.session_id);
  const providerStatus = readString(payload.status);
  const webhookType = readString(payload.webhook_type) ?? "status.updated";
  const vendorData = readString(payload.vendor_data);
  const providerEventId = getDiditProviderEventId(payload, fallbackTimestamp);
  const providerVerificationId = getDiditProviderVerificationId(payload);

  if (!providerSessionId) {
    throw new Error("Didit webhook payload is missing session_id.");
  }

  if (!providerStatus) {
    throw new Error("Didit webhook payload is missing status.");
  }

  return {
    providerEventId,
    providerSessionId,
    providerVerificationId,
    providerStatus,
    webhookType,
    vendorData,
  };
}

export function getDiditSessionProviderVerificationId(session: DiditSessionResponse) {
  return typeof session.verification_id === "string" && session.verification_id.trim()
    ? session.verification_id.trim()
    : null;
}

export function getDiditSessionUrlFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const record = payload as Record<string, unknown>;
  return readString(record.url);
}

export function isActiveDiditProviderStatus(status: string | null | undefined) {
  return (
    status === "Not Started" ||
    status === "In Progress" ||
    status === "In Review" ||
    status === "Resubmitted"
  );
}
