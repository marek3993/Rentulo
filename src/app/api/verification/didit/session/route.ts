import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/auth-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { buildServiceSupabaseClient } from "@/lib/supabaseAdmin";
import {
  createDiditSession,
  getDiditSessionProviderVerificationId,
  getDiditSessionUrlFromPayload,
  isActiveDiditProviderStatus,
} from "@/lib/diditServer";

export const runtime = "nodejs";

type VerificationStatus = "not_submitted" | "pending" | "approved" | "rejected" | string;

type UserVerificationRow = {
  id: number;
  user_id: string;
  status: VerificationStatus;
  account_type: string | null;
  verification_provider: string | null;
  provider_session_id: string | null;
  provider_verification_id: string | null;
  provider_status: string | null;
  provider_payload: unknown;
  provider_synced_at: string | null;
};

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function resolveSiteUrl(req: NextRequest) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return normalizeBaseUrl(configuredUrl);
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.trim() || "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return normalizeBaseUrl(req.nextUrl.origin);
}

function getBearerToken(req: NextRequest) {
  const authorization = req.headers.get("authorization")?.trim() ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = authorization.slice(7).trim();
  return token || null;
}

function getAccountTypeFromUser(user: User) {
  const value = user.user_metadata?.account_type;

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

async function getUserFromRequest(supabase: SupabaseClient, req: NextRequest) {
  const token = getBearerToken(req);

  if (!token) {
    return null;
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user;
}

async function getVerificationRow(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_verifications")
    .select(
      "id,user_id,status,account_type,verification_provider,provider_session_id,provider_verification_id,provider_status,provider_payload,provider_synced_at"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? null) as UserVerificationRow | null;
}

async function createPendingVerificationRow(supabase: SupabaseClient, user: User) {
  const { data, error } = await supabase
    .from("user_verifications")
    .insert({
      user_id: user.id,
      status: "pending",
      account_type: getAccountTypeFromUser(user),
      verification_provider: "didit",
      provider_status: "Not Started",
      provider_synced_at: new Date().toISOString(),
    })
    .select(
      "id,user_id,status,account_type,verification_provider,provider_session_id,provider_verification_id,provider_status,provider_payload,provider_synced_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as UserVerificationRow;
}

async function updateVerificationWithSession(
  supabase: SupabaseClient,
  verificationId: number,
  session: Awaited<ReturnType<typeof createDiditSession>>
) {
  const nowIso = new Date().toISOString();

  const { error } = await supabase
    .from("user_verifications")
    .update({
      status: "pending",
      verification_provider: "didit",
      provider_session_id: session.session_id,
      provider_verification_id: getDiditSessionProviderVerificationId(session),
      provider_status: session.status ?? "Not Started",
      provider_payload: session,
      provider_synced_at: nowIso,
    })
    .eq("id", verificationId);

  if (error) {
    throw new Error(error.message);
  }
}

function getReusableVerificationUrl(row: UserVerificationRow) {
  if (!isActiveDiditProviderStatus(row.provider_status)) {
    return null;
  }

  return getDiditSessionUrlFromPayload(row.provider_payload);
}

export async function POST(req: NextRequest) {
  try {
    const supabase = buildServiceSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Supabase service role is not configured on the server." },
        { status: 500 }
      );
    }

    const user = await getUserFromRequest(supabase, req);

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!user.email) {
      return NextResponse.json(
        { error: "User email is required for Didit verification." },
        { status: 400 }
      );
    }

    let verification = await getVerificationRow(supabase, user.id);

    if (verification?.status === "approved") {
      return NextResponse.json({
        ok: true,
        alreadyApproved: true,
      });
    }

    if (!verification) {
      verification = await createPendingVerificationRow(supabase, user);
    }

    const reusableUrl = getReusableVerificationUrl(verification);

    if (
      verification.verification_provider === "didit" &&
      verification.provider_session_id &&
      reusableUrl
    ) {
      return NextResponse.json({
        ok: true,
        reused: true,
        verificationUrl: reusableUrl,
        providerSessionId: verification.provider_session_id,
        providerStatus: verification.provider_status,
      });
    }

    const siteUrl = resolveSiteUrl(req);
    const callbackUrl = `${siteUrl}/verification`;

    const session = await createDiditSession({
      userId: user.id,
      userEmail: user.email,
      userVerificationId: verification.id,
      callbackUrl,
    });

    await updateVerificationWithSession(supabase, verification.id, session);

    return NextResponse.json({
      ok: true,
      verificationUrl: session.url,
      providerSessionId: session.session_id,
      providerStatus: session.status ?? "Not Started",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Didit session creation failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
