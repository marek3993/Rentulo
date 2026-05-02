import { NextRequest, NextResponse } from "next/server";

import {
  refreshStripeConnectProfile,
  requireStripeConnectOwner,
} from "@/lib/stripeConnectServer";

export const runtime = "nodejs";

async function handleStatus(req: NextRequest) {
  const context = await requireStripeConnectOwner(req);

  if (!context.ok) {
    return context.response;
  }

  try {
    const result = await refreshStripeConnectProfile(context.supabase, context.user.id);

    if (!result.connected) {
      return NextResponse.json({
        ok: true,
        connected: false,
        refreshed: false,
        reason: "not_connected",
        connect: result.connectProfile,
      });
    }

    return NextResponse.json({
      ok: true,
      connected: true,
      refreshed: result.refreshed,
      connect: result.connectProfile,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nepodarilo sa zosynchronizovat Stripe Connect stav.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return handleStatus(req);
}

export async function POST(req: NextRequest) {
  return handleStatus(req);
}
