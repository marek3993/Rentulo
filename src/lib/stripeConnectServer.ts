import "server-only";

import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/auth-js";
import type Stripe from "stripe";

import { buildServiceSupabaseClient } from "@/lib/supabaseAdmin";
import {
  createStripeConnectedAccount,
  getDefaultStripeConnectProfileState,
  getStripeConnectAccountStatus,
  getStripe,
  isStripeConfigured,
  normalizeStripeConnectOnboardingStatus,
  retrieveStripeConnectedAccount,
  STRIPE_CONNECT_PROFILE_SELECT,
  type StripeConnectProfileState,
} from "@/lib/stripe";

type ConnectProfileRow = {
  id: string;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_status: string | null;
  stripe_payouts_enabled: boolean | null;
  stripe_charges_enabled: boolean | null;
  stripe_connect_details_submitted: boolean | null;
};

type PaymentOwnerContext =
  | {
      ok: true;
      supabase: SupabaseClient;
      stripe: Stripe;
      user: User;
    }
  | {
      ok: false;
      response: NextResponse;
    };

function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization")?.trim() ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

function buildAuthenticatedSupabaseClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const authorization = req.headers.get("authorization")?.trim();

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: authorization
      ? {
          headers: {
            Authorization: authorization,
          },
        }
      : undefined,
  });
}

function toStoredConnectProfileState(profile: ConnectProfileRow | null | undefined): StripeConnectProfileState {
  if (!profile) {
    return getDefaultStripeConnectProfileState();
  }

  return {
    stripe_connect_account_id: profile.stripe_connect_account_id ?? null,
    stripe_connect_onboarding_status: normalizeStripeConnectOnboardingStatus(
      profile.stripe_connect_onboarding_status
    ),
    stripe_payouts_enabled: profile.stripe_payouts_enabled ?? false,
    stripe_charges_enabled: profile.stripe_charges_enabled ?? false,
    stripe_connect_details_submitted: profile.stripe_connect_details_submitted ?? false,
  };
}

export function buildStripeConnectUnavailableResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "Stripe Connect nie je na serveri nakonfigurovany.",
      reason: "stripe_not_configured",
    },
    { status: 503 }
  );
}

export async function requireStripeConnectOwner(req: NextRequest): Promise<PaymentOwnerContext> {
  const supabase = buildAuthenticatedSupabaseClient(req);

  if (!supabase) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Supabase auth klient nie je na serveri nakonfigurovany.",
          reason: "supabase_auth_not_configured",
        },
        { status: 500 }
      ),
    };
  }

  if (!isStripeConfigured()) {
    return {
      ok: false,
      response: buildStripeConnectUnavailableResponse(),
    };
  }

  const stripe = getStripe();

  if (!stripe) {
    return {
      ok: false,
      response: buildStripeConnectUnavailableResponse(),
    };
  }

  const token = getBearerToken(req);

  if (!token) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Missing bearer token." }, { status: 401 }),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 }),
    };
  }

  return {
    ok: true,
    supabase,
    stripe,
    user,
  };
}

export async function readStoredStripeConnectProfile(
  supabase: SupabaseClient,
  userId: string
): Promise<StripeConnectProfileState> {
  const { data, error } = await supabase
    .from("profiles")
    .select(STRIPE_CONNECT_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Nepodarilo sa nacitat Stripe Connect stav: ${error.message}`);
  }

  return toStoredConnectProfileState((data ?? null) as ConnectProfileRow | null);
}

export async function writeStoredStripeConnectProfile(
  userId: string,
  profileState: StripeConnectProfileState
) {
  const supabase = buildServiceSupabaseClient();

  if (!supabase) {
    throw new Error("Supabase service role nie je na serveri nakonfigurovany.");
  }

  const { error } = await supabase.rpc("owner_stripe_connect_status_upsert", {
    p_user_id: userId,
    p_stripe_connect_account_id: profileState.stripe_connect_account_id,
    p_stripe_connect_onboarding_status: profileState.stripe_connect_onboarding_status,
    p_stripe_payouts_enabled: profileState.stripe_payouts_enabled,
    p_stripe_charges_enabled: profileState.stripe_charges_enabled,
    p_stripe_connect_details_submitted: profileState.stripe_connect_details_submitted,
  });

  if (error) {
    throw new Error(`Nepodarilo sa ulozit Stripe Connect stav: ${error.message}`);
  }
}

export async function syncStripeConnectProfileFromAccount(
  userId: string,
  account: Parameters<typeof getStripeConnectAccountStatus>[0]
) {
  const profileState = getStripeConnectAccountStatus(account);

  await writeStoredStripeConnectProfile(userId, profileState);
  return profileState;
}

export async function getOrCreateStripeConnectAccount(
  supabase: SupabaseClient,
  user: Pick<User, "id" | "email">
) {
  const storedProfile = await readStoredStripeConnectProfile(supabase, user.id);
  const storedAccountId = storedProfile.stripe_connect_account_id;
  const stripe = getStripe();

  if (!stripe) {
    throw new Error("Stripe Connect nie je na serveri nakonfigurovany.");
  }

  if (storedAccountId) {
    const existingAccount = await retrieveStripeConnectedAccount(storedAccountId, stripe);

    if (existingAccount) {
      const connectProfile = await syncStripeConnectProfileFromAccount(user.id, existingAccount);

      return {
        account: existingAccount,
        connectProfile,
        created: false,
      };
    }

    await syncStripeConnectProfileFromAccount(user.id, null);
  }

  const createdAccount = await createStripeConnectedAccount(
    {
      userId: user.id,
      email: user.email ?? undefined,
    },
    stripe
  );

  if (!createdAccount) {
    throw new Error("Stripe Connect nie je na serveri nakonfigurovany.");
  }

  const connectProfile = await syncStripeConnectProfileFromAccount(user.id, createdAccount);

  return {
    account: createdAccount,
    connectProfile,
    created: true,
  };
}

export async function refreshStripeConnectProfile(
  supabase: SupabaseClient,
  userId: string
) {
  const storedProfile = await readStoredStripeConnectProfile(supabase, userId);
  const stripe = getStripe();

  if (!stripe) {
    throw new Error("Stripe Connect nie je na serveri nakonfigurovany.");
  }

  if (!storedProfile.stripe_connect_account_id) {
    const connectProfile = await syncStripeConnectProfileFromAccount(userId, null);

    return {
      connectProfile,
      connected: false,
      refreshed: false,
    };
  }

  const account = await retrieveStripeConnectedAccount(
    storedProfile.stripe_connect_account_id,
    stripe
  );
  const connectProfile = await syncStripeConnectProfileFromAccount(userId, account);

  return {
    connectProfile,
    connected: Boolean(connectProfile.stripe_connect_account_id),
    refreshed: Boolean(account),
  };
}

export function resolveStripeConnectBaseUrl(req: NextRequest) {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredUrl) {
    return configuredUrl.replace(/\/+$/, "");
  }

  const forwardedHost = req.headers.get("x-forwarded-host")?.trim();
  const forwardedProto = req.headers.get("x-forwarded-proto")?.trim() || "https";

  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return req.nextUrl.origin.replace(/\/+$/, "");
}
