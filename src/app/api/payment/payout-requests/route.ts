import { NextRequest, NextResponse } from "next/server";

import {
  buildInternalManualPayoutWorkflow,
  buildStripeConnectReadinessResponse,
  callRpcWithVariants,
  extractRecordIdentifier,
  listTableRows,
  readPayoutRequestById,
  readStripeConnectReadiness,
  requireAuthenticatedPaymentUser,
  sanitizeRouteRecord,
  sanitizeRouteRecords,
} from "@/lib/paymentApiServer";

export const runtime = "nodejs";

type CreatePayoutRequestBody = {
  amount?: number | string | null;
  requestedAmount?: number | string | null;
  requested_amount?: number | string | null;
  note?: string | null;
  currency?: string | null;
  provider?: string | null;
  payoutProvider?: string | null;
  payout_provider?: string | null;
};

type PayoutRequestProvider = "manual_sepa" | "stripe_connect";

const DEFAULT_PAYOUT_REQUEST_PROVIDER: PayoutRequestProvider = "manual_sepa";
const ALLOWED_PAYOUT_REQUEST_PROVIDERS = new Set<PayoutRequestProvider>([
  "manual_sepa",
  "stripe_connect",
]);

function parsePage(value: string | null) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parsePageSize(value: string | null) {
  const pageSize = Number(value);

  if (!Number.isInteger(pageSize) || pageSize <= 0) {
    return 20;
  }

  return Math.min(pageSize, 100);
}

function parsePositiveAmount(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(",", ".");

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalNote(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Invalid note.");
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function parseOptionalCurrency(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Invalid currency.");
  }

  const trimmed = value.trim().toUpperCase();

  if (!trimmed) {
    return null;
  }

  if (!/^[A-Z]{3}$/.test(trimmed)) {
    throw new Error("Currency must be a 3-letter ISO code.");
  }

  return trimmed;
}

function parseOptionalPayoutRequestProvider(value: unknown): PayoutRequestProvider | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Invalid payout request provider.");
  }

  const trimmed = value.trim().toLowerCase();

  if (!trimmed) {
    return null;
  }

  if (ALLOWED_PAYOUT_REQUEST_PROVIDERS.has(trimmed as PayoutRequestProvider)) {
    return trimmed as PayoutRequestProvider;
  }

  throw new Error("Payout request provider must be manual_sepa or stripe_connect.");
}

export async function GET(req: NextRequest) {
  const context = await requireAuthenticatedPaymentUser(req);

  if (!context.ok) {
    return context.response;
  }

  const page = parsePage(req.nextUrl.searchParams.get("page"));
  const pageSize = parsePageSize(req.nextUrl.searchParams.get("pageSize"));

  try {
    const [listResult, connectProfile] = await Promise.all([
      listTableRows(context.supabase, "payout_requests", page, pageSize),
      readStripeConnectReadiness(context.supabase, context.user.id),
    ]);

    return NextResponse.json({
      ok: true,
      rows: sanitizeRouteRecords(listResult.rows),
      total: listResult.total,
      page,
      pageSize,
      connect: buildStripeConnectReadinessResponse(connectProfile),
      workflow: buildInternalManualPayoutWorkflow(),
      unknowns: [
        "Payout requests are internal/manual in P1. This route does not trigger Stripe payouts or SEPA execution.",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payout requests.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const context = await requireAuthenticatedPaymentUser(req);

  if (!context.ok) {
    return context.response;
  }

  try {
    const body = (await req.json().catch(() => null)) as CreatePayoutRequestBody | null;
    const amount = parsePositiveAmount(
      body?.amount ?? body?.requestedAmount ?? body?.requested_amount ?? null
    );

    if (!amount) {
      return NextResponse.json(
        { ok: false, error: "Missing or invalid payout request amount." },
        { status: 400 }
      );
    }

    const note = parseOptionalNote(body?.note ?? null);
    let currency: string | null;
    let provider: PayoutRequestProvider;

    try {
      currency = parseOptionalCurrency(body?.currency ?? null);
      provider =
        parseOptionalPayoutRequestProvider(
          body?.provider ?? body?.payoutProvider ?? body?.payout_provider ?? null
        ) ?? DEFAULT_PAYOUT_REQUEST_PROVIDER;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid payout request payload.";
      return NextResponse.json({ ok: false, error: message }, { status: 400 });
    }

    if (currency && currency !== "EUR") {
      return NextResponse.json(
        { ok: false, error: "Only EUR payout requests are supported in this phase." },
        { status: 400 }
      );
    }

    const [rpcResult, connectProfile] = await Promise.all([
      callRpcWithVariants(
        context.supabase,
        "earnings_create_payout_request_v1",
        [
          {
            label: "confirmed_db_contract",
            args: {
              p_provider: provider,
              p_amount: amount,
              p_note: note,
            },
          },
        ]
      ),
      readStripeConnectReadiness(context.supabase, context.user.id),
    ]);

    const requestIdentifier = extractRecordIdentifier(rpcResult.data);
    let payoutRequest = sanitizeRouteRecord(rpcResult.data);

    if (requestIdentifier !== null) {
      try {
        const row = await readPayoutRequestById(context.supabase, requestIdentifier);
        payoutRequest = sanitizeRouteRecord(row);
      } catch {
        // Keep the RPC result if the row cannot be re-read by id.
      }
    }

    return NextResponse.json({
      ok: true,
      payoutRequest,
      payoutRequestId: requestIdentifier,
      rpcVariant: rpcResult.variant,
      connect: buildStripeConnectReadinessResponse(connectProfile),
      workflow: buildInternalManualPayoutWorkflow(),
      unknowns: [
        "Payout request creation is internal/manual in P1. No Stripe payout or SEPA transfer is executed here.",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create payout request.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
