import { NextRequest, NextResponse } from "next/server";

import {
  buildAccountProfileUpdatePayload,
  buildInternalManualPayoutWorkflow,
  buildStripeConnectReadinessResponse,
  readStripeConnectReadiness,
  readVisibleAccountProfile,
  requireAuthenticatedPaymentUser,
  sanitizeRouteRecord,
  updateVisibleAccountProfile,
} from "@/lib/paymentApiServer";

export const runtime = "nodejs";

function buildMissingAccountProfileResponse(connect: ReturnType<typeof buildStripeConnectReadinessResponse>) {
  return NextResponse.json(
    {
      ok: false,
      error: "The current account profile row is not initialized.",
      reason: "account_profile_not_initialized",
      accountProfile: null,
      connect,
      workflow: buildInternalManualPayoutWorkflow(),
      unknowns: [
        "account_profiles row creation contract is not locked in the repo truth export yet.",
      ],
    },
    { status: 409 }
  );
}

export async function GET(req: NextRequest) {
  const context = await requireAuthenticatedPaymentUser(req);

  if (!context.ok) {
    return context.response;
  }

  try {
    const [accountProfileRow, connectProfile] = await Promise.all([
      readVisibleAccountProfile(context.supabase),
      readStripeConnectReadiness(context.supabase, context.user.id),
    ]);

    const unknowns =
      accountProfileRow === null
        ? ["account_profiles row is not visible or not initialized for the current user."]
        : [];

    return NextResponse.json({
      ok: true,
      accountProfile: sanitizeRouteRecord(accountProfileRow),
      connect: buildStripeConnectReadinessResponse(connectProfile),
      workflow: buildInternalManualPayoutWorkflow(),
      unknowns,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load account profile.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

async function updateAccountProfile(req: NextRequest) {
  const context = await requireAuthenticatedPaymentUser(req);

  if (!context.ok) {
    return context.response;
  }

  try {
    const body = (await req.json().catch(() => null)) as unknown;
    const [accountProfileRow, connectProfile] = await Promise.all([
      readVisibleAccountProfile(context.supabase),
      readStripeConnectReadiness(context.supabase, context.user.id),
    ]);
    const connect = buildStripeConnectReadinessResponse(connectProfile);

    if (!accountProfileRow) {
      return buildMissingAccountProfileResponse(connect);
    }

    const { invalidFields, payload, unknownFields } = buildAccountProfileUpdatePayload(
      body,
      accountProfileRow
    );

    if (unknownFields.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Request contains fields that are not locked in the readable account profile row.",
          unknownFields,
          connect,
          workflow: buildInternalManualPayoutWorkflow(),
        },
        { status: 400 }
      );
    }

    if (invalidFields.length > 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "Request contains read-only, sensitive, or invalid account profile fields.",
          invalidFields,
          connect,
          workflow: buildInternalManualPayoutWorkflow(),
        },
        { status: 400 }
      );
    }

    if (Object.keys(payload).length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No writable account profile fields were provided.",
          connect,
          workflow: buildInternalManualPayoutWorkflow(),
        },
        { status: 400 }
      );
    }

    const updatedRow = await updateVisibleAccountProfile(context.supabase, accountProfileRow, payload);

    return NextResponse.json({
      ok: true,
      accountProfile: sanitizeRouteRecord(updatedRow),
      updatedFields: Object.keys(payload),
      connect,
      workflow: buildInternalManualPayoutWorkflow(),
      unknowns: [
        "Account profile writes are limited to fields already visible on the current row because the repo truth export does not yet lock the full account_profiles schema.",
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update account profile.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return updateAccountProfile(req);
}

export async function PATCH(req: NextRequest) {
  return updateAccountProfile(req);
}
