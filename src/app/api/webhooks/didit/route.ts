import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildServiceSupabaseClient } from "@/lib/supabaseAdmin";
import {
  getDiditWebhookCore,
  verifyDiditWebhookSignature,
  type DiditWebhookPayload,
} from "@/lib/diditServer";

export const runtime = "nodejs";

type VerificationLookupRow = {
  id: number;
  user_id: string;
  provider_last_event_id: string | null;
};

type RpcErrorLike = {
  code?: string;
  message?: string;
};

function isDuplicateError(error: RpcErrorLike | null) {
  if (!error) return false;

  if (error.code === "23505") {
    return true;
  }

  return (error.message ?? "").toLowerCase().includes("duplicate");
}

function looksLikeUuid(value: string | null) {
  if (!value) return false;

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function findVerification(
  supabase: SupabaseClient,
  providerSessionId: string,
  vendorData: string | null
) {
  const bySession = await supabase
    .from("user_verifications")
    .select("id,user_id,provider_last_event_id")
    .eq("provider_session_id", providerSessionId)
    .maybeSingle();

  if (bySession.error) {
    throw new Error(bySession.error.message);
  }

  if (bySession.data) {
    return bySession.data as VerificationLookupRow;
  }

  if (!looksLikeUuid(vendorData)) {
    return null;
  }

  const byUser = await supabase
    .from("user_verifications")
    .select("id,user_id,provider_last_event_id")
    .eq("user_id", vendorData)
    .maybeSingle();

  if (byUser.error) {
    throw new Error(byUser.error.message);
  }

  return (byUser.data ?? null) as VerificationLookupRow | null;
}

async function syncProviderStatus({
  supabase,
  userVerificationId,
  providerSessionId,
  providerVerificationId,
  providerEventId,
  providerStatus,
  payload,
}: {
  supabase: SupabaseClient;
  userVerificationId: number;
  providerSessionId: string;
  providerVerificationId: string | null;
  providerEventId: string;
  providerStatus: string;
  payload: DiditWebhookPayload;
}) {
  const { error } = await supabase.rpc("verification_provider_status_sync_v1", {
    p_user_verification_id: userVerificationId,
    p_provider: "didit",
    p_provider_session_id: providerSessionId,
    p_provider_verification_id: providerVerificationId,
    p_provider_status: providerStatus,
    p_provider_event_id: providerEventId,
    p_provider_payload: payload,
  });

  if (error) {
    return {
      ok: false as const,
      duplicate: isDuplicateError(error),
      error: error.message,
    };
  }

  return {
    ok: true as const,
    duplicate: false,
    error: null,
  };
}

export async function POST(req: NextRequest) {
  let payload: DiditWebhookPayload;

  try {
    payload = (await req.json()) as DiditWebhookPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  try {
    const signature = verifyDiditWebhookSignature({
      payload,
      headers: req.headers,
    });

    if (!signature.ok) {
      return NextResponse.json(
        {
          error: "Invalid Didit webhook signature.",
          reason: signature.reason,
        },
        { status: 401 }
      );
    }

    const supabase = buildServiceSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase service role is not configured on the server." },
        { status: 500 }
      );
    }

    const {
      providerEventId,
      providerSessionId,
      providerVerificationId,
      providerStatus,
      vendorData,
    } = getDiditWebhookCore(payload, req.headers.get("x-timestamp"));

    const verification = await findVerification(supabase, providerSessionId, vendorData);

    if (!verification) {
      return NextResponse.json({
        ok: true,
        ignored: true,
        reason: "verification_not_found",
        providerEventId,
        providerSessionId,
      });
    }

    if (verification.provider_last_event_id === providerEventId) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        providerEventId,
      });
    }

    const syncResult = await syncProviderStatus({
      supabase,
      userVerificationId: verification.id,
      providerSessionId,
      providerVerificationId,
      providerEventId,
      providerStatus,
      payload,
    });

    if (syncResult.duplicate) {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        providerEventId,
      });
    }

    if (!syncResult.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: syncResult.error,
          providerEventId,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      providerEventId,
      providerSessionId,
      providerVerificationId,
      providerStatus,
      signatureMethod: signature.method,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Didit webhook processing failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
