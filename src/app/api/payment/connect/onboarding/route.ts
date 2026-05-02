import { NextRequest, NextResponse } from "next/server";

import { createStripeConnectOnboardingLink } from "@/lib/stripe";
import {
  getOrCreateStripeConnectAccount,
  requireStripeConnectOwner,
  resolveStripeConnectBaseUrl,
} from "@/lib/stripeConnectServer";

export const runtime = "nodejs";

function buildConnectReturnUrls(req: NextRequest) {
  const baseUrl = resolveStripeConnectBaseUrl(req);

  return {
    refreshUrl: `${baseUrl}/profile?connect=refresh`,
    returnUrl: `${baseUrl}/profile?connect=return`,
  };
}

export async function POST(req: NextRequest) {
  const context = await requireStripeConnectOwner(req);

  if (!context.ok) {
    return context.response;
  }

  try {
    const result = await getOrCreateStripeConnectAccount(context.supabase, context.user);
    const { refreshUrl, returnUrl } = buildConnectReturnUrls(req);

    const accountLink = await createStripeConnectOnboardingLink(
      {
        accountId: result.account.id,
        refreshUrl,
        returnUrl,
      },
      context.stripe
    );

    if (!accountLink) {
      return NextResponse.json(
        {
          ok: false,
          error: "Stripe Connect nie je na serveri nakonfigurovany.",
          reason: "stripe_not_configured",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      ok: true,
      created: result.created,
      connected: true,
      onboardingUrl: accountLink.url,
      url: accountLink.url,
      expiresAt: accountLink.expires_at,
      connect: result.connectProfile,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nepodarilo sa pripravit Stripe onboarding link.";

    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
