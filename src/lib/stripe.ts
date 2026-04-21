import "server-only";

import Stripe from "stripe";

let stripeClient: Stripe | null | undefined;

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

export function isStripeConfigured() {
  return Boolean(getStripeSecretKey());
}
