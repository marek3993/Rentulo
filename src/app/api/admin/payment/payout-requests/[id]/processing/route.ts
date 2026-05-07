import { NextRequest, NextResponse } from "next/server";

import {
  buildMarkPayoutRequestProcessingVariants,
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

type ProcessingBody = {
  note?: string | null;
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
    const body = (await req.json().catch(() => null)) as ProcessingBody | null;
    const note = parseOptionalAdminText(body?.note ?? null, "note");
    const rpcResult = await callRpcWithVariants(
      admin.supabase,
      "admin_mark_payout_request_processing_v1",
      buildMarkPayoutRequestProcessingVariants({
        adminUserId: admin.adminUserId,
        payoutRequestId,
        note,
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
      "payout_request_processing",
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
      error instanceof Error ? error.message : "Failed to mark payout request as processing.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
