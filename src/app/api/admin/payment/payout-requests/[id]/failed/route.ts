import { NextRequest, NextResponse } from "next/server";

import {
  buildMarkPayoutRequestFailedVariants,
  parseOptionalAdminText,
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

type FailedBody = {
  note?: string | null;
  failureReason?: string | null;
  failure_reason?: string | null;
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
    const body = (await req.json().catch(() => null)) as FailedBody | null;
    const note = parseOptionalAdminText(body?.note ?? null, "note");
    const failureReason = parseOptionalAdminText(
      body?.failureReason ?? body?.failure_reason ?? null,
      "failureReason"
    );
    const rpcResult = await callRpcWithVariants(
      admin.supabase,
      "admin_mark_payout_request_failed_v1",
      buildMarkPayoutRequestFailedVariants({
        adminUserId: admin.adminUserId,
        payoutRequestId,
        note,
        failureReason,
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
      "payout_request_failed",
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
    const message =
      error instanceof Error ? error.message : "Failed to mark payout request as failed.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
