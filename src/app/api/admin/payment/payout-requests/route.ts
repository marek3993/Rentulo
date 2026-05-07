import { NextRequest, NextResponse } from "next/server";

import {
  buildInternalManualPayoutWorkflow,
  listTableRows,
  sanitizeRouteRecords,
} from "@/lib/paymentApiServer";
import { requireAdminRoute } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

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

export async function GET(req: NextRequest) {
  const admin = await requireAdminRoute(req);

  if (!admin.ok) {
    return admin.response;
  }

  const page = parsePage(req.nextUrl.searchParams.get("page"));
  const pageSize = parsePageSize(req.nextUrl.searchParams.get("pageSize"));

  try {
    const listResult = await listTableRows(admin.supabase, "payout_requests", page, pageSize);

    return NextResponse.json({
      ok: true,
      rows: sanitizeRouteRecords(listResult.rows),
      total: listResult.total,
      page,
      pageSize,
      workflow: buildInternalManualPayoutWorkflow(),
      unknowns: [
        "P1 payout handling is internal/manual. This admin route does not trigger provider payout automation.",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load payout requests.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
