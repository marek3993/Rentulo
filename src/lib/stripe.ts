import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null | undefined;

export type StripeConnectOnboardingStatus = "not_started" | "pending" | "completed";

export type StripeConnectProfileState = {
  stripe_connect_account_id: string | null;
  stripe_connect_onboarding_status: StripeConnectOnboardingStatus;
  stripe_payouts_enabled: boolean;
  stripe_charges_enabled: boolean;
  stripe_connect_details_submitted: boolean;
};

export const STRIPE_CONNECT_PROFILE_SELECT =
  "id,stripe_connect_account_id,stripe_connect_onboarding_status,stripe_payouts_enabled,stripe_charges_enabled,stripe_connect_details_submitted";

function getStripeSecretKey() {
  const secretKey = process.env.STRIPE_SECRET_KEY?.trim();
  return secretKey || null;
}

export function getStripe() {
  const secretKey = getStripeSecretKey();

  if (!secretKey) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey);
  }

  return stripeClient;
}

export function getStripeWebhookSecret() {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  return webhookSecret || null;
}

export type CreateStripeConnectAccountParams = {
  userId: string;
  email?: string | null;
  country?: string | null;
};

export type CreateStripeConnectOnboardingLinkParams = {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
};

export function getStripeConnectCountry() {
  const country = process.env.STRIPE_CONNECT_COUNTRY?.trim().toUpperCase();
  return country || "SK";
}

export function normalizeStripeConnectOnboardingStatus(
  value: string | null | undefined
): StripeConnectOnboardingStatus {
  if (value === "pending" || value === "completed") {
    return value;
  }

  return "not_started";
}

export function deriveStripeConnectOnboardingStatus(
  account:
    | Pick<Stripe.Account, "details_submitted" | "payouts_enabled">
    | null
    | undefined
): StripeConnectOnboardingStatus {
  if (!account) {
    return "not_started";
  }

  if (account.details_submitted && account.payouts_enabled) {
    return "completed";
  }

  return "pending";
}

export function getDefaultStripeConnectProfileState(): StripeConnectProfileState {
  return {
    stripe_connect_account_id: null,
    stripe_connect_onboarding_status: "not_started",
    stripe_payouts_enabled: false,
    stripe_charges_enabled: false,
    stripe_connect_details_submitted: false,
  };
}

export function toStripeConnectProfileState(
  account: Pick<Stripe.Account, "id" | "details_submitted" | "payouts_enabled" | "charges_enabled">
): StripeConnectProfileState {
  return {
    stripe_connect_account_id: account.id,
    stripe_connect_onboarding_status: deriveStripeConnectOnboardingStatus(account),
    stripe_payouts_enabled: account.payouts_enabled,
    stripe_charges_enabled: account.charges_enabled,
    stripe_connect_details_submitted: account.details_submitted,
  };
}

function isMissingStripeAccountError(error: unknown) {
  return error instanceof Error && /No such account/i.test(error.message);
}

export async function retrieveStripeConnectedAccount(
  accountId: string | null | undefined,
  stripe: Stripe | null = getStripe()
) {
  if (!stripe || !accountId) {
    return null;
  }

  try {
    const account = await stripe.accounts.retrieve(accountId);

    if ("deleted" in account && account.deleted) {
      return null;
    }

    return account;
  } catch (error) {
    if (isMissingStripeAccountError(error)) {
      return null;
    }

    throw error;
  }
}

export async function createStripeConnectedAccount(
  params: CreateStripeConnectAccountParams,
  stripe: Stripe | null = getStripe()
) {
  if (!stripe) {
    return null;
  }

  return stripe.accounts.create({
    type: "express",
    country: params.country?.trim().toUpperCase() || getStripeConnectCountry(),
    email: params.email ?? undefined,
    capabilities: {
      transfers: {
        requested: true,
      },
    },
    metadata: {
      rentulo_user_id: params.userId,
    },
  });
}

export async function createStripeConnectOnboardingLink(
  params: CreateStripeConnectOnboardingLinkParams,
  stripe: Stripe | null = getStripe()
) {
  if (!stripe) {
    return null;
  }

  return stripe.accountLinks.create({
    account: params.accountId,
    refresh_url: params.refreshUrl,
    return_url: params.returnUrl,
    type: "account_onboarding",
  });
}

export function getStripeConnectAccountStatus(
  account:
    | Pick<Stripe.Account, "id" | "details_submitted" | "payouts_enabled" | "charges_enabled">
    | null
    | undefined
) {
  return account ? toStripeConnectProfileState(account) : getDefaultStripeConnectProfileState();
}

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey());
}
