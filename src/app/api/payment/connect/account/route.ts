import { NextRequest, NextResponse } from "next/server";

import { getOrCreateStripeConnectAccount, requireStripeConnectOwner } from "@/lib/stripeConnectServer";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const context = await requireStripeConnectOwner(req);

  if (!context.ok) {
    return context.response;
  }

  try {
    const result = await getOrCreateStripeConnectAccount(context.supabase, context.user);

    return NextResponse.json({
      ok: true,
      created: result.created,
      connected: Boolean(result.connectProfile.stripe_connect_account_id),
      connect: result.connectProfile,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nepodarilo sa pripravit Stripe Connect ucet.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
