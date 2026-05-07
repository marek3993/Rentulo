import { NextRequest, NextResponse } from "next/server";

import {
  buildMarkPayoutRequestPaidVariants,
  parseOptionalAdminText,
  parseOptionalIsoDateTime,
} from "@/lib/adminPayoutRequestServer";
import {
  buildInternalManualPayoutWorkflow,
  callRpcWithVariants,
  readPayoutRequestById,
  sanitizeRouteRecord,
} from "@/lib/paymentApiServer";
import { bestEffortLogAdminAction, requireAdminRoute } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type Params = {
  params: Promise<{ id: string }>;
};

type PaidBody = {
  note?: string | null;
  providerRef?: string | null;
  provider_ref?: string | null;
  paidAt?: string | null;
  paid_at?: string | null;
};

function buildInvalidIdResponse() {
  return NextResponse.json({ ok: false, error: "Invalid payout request id." }, { status: 400 });
}

export async function POST(req: NextRequest, { params }: Params) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const { id } = await params;
  const payoutRequestId = Number(id);

  if (!Number.isInteger(payoutRequestId) || payoutRequestId <= 0) {
    return buildInvalidIdResponse();
  }

  try {
    const body = (await req.json().catch(() => null)) as PaidBody | null;
    const note = parseOptionalAdminText(body?.note ?? null, "note");
    const providerRef = parseOptionalAdminText(
      body?.providerRef ?? body?.provider_ref ?? null,
      "providerRef"
    );
    const paidAt = parseOptionalIsoDateTime(body?.paidAt ?? body?.paid_at ?? null, "paidAt");
    const rpcResult = await callRpcWithVariants(
      admin.supabase,
      "admin_mark_payout_request_paid_v1",
      buildMarkPayoutRequestPaidVariants({
        adminUserId: admin.adminUserId,
        payoutRequestId,
        note,
        providerRef,
        paidAt,
      })
    );

    let payoutRequest = null;

    try {
      payoutRequest = sanitizeRouteRecord(await readPayoutRequestById(admin.supabase, payoutRequestId));
    } catch {
      payoutRequest = sanitizeRouteRecord(rpcResult.data);
    }

    await bestEffortLogAdminAction(
      admin.supabase,
      "payout_request_paid",
      "payout_requests",
      String(payoutRequestId)
    );

    return NextResponse.json({
      ok: true,
      payoutRequest,
      rpcVariant: rpcResult.variant,
      workflow: buildInternalManualPayoutWorkflow(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to mark payout request as paid.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
