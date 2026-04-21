import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

import { getStripe, getStripeWebhookSecret } from "@/lib/stripe";

export const runtime = "nodejs";

function buildServiceSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function parseReservationId(value: string | null | undefined) {
  const reservationId = Number(value);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return null;
  }

  return reservationId;
}

function getReservationIdFromMetadata(metadata: Stripe.Metadata | null | undefined) {
  return parseReservationId(metadata?.reservationId ?? metadata?.reservation_id);
}

async function recordPaymentEvent(
  supabase: ReturnType<typeof buildServiceSupabaseClient>,
  reservationId: number,
  eventType: string,
  note: string
) {
  if (!supabase) {
    return;
  }

  const { data: existingEvent, error: existingEventError } = await supabase
    .from("payment_events")
    .select("id")
    .eq("reservation_id", reservationId)
    .eq("event_type", eventType)
    .eq("note", note)
    .maybeSingle();

  if (existingEventError) {
    throw existingEventError;
  }

  if (existingEvent) {
    return;
  }

  const { error: insertError } = await supabase.from("payment_events").insert({
    reservation_id: reservationId,
    event_type: eventType,
    provider: "stripe",
    note,
  });

  if (insertError) {
    throw insertError;
  }
}

async function updateReservationPayment(
  supabase: ReturnType<typeof buildServiceSupabaseClient>,
  reservationId: number,
  paymentStatus: "paid" | "failed"
) {
  if (!supabase) {
    return;
  }

  const { error } = await supabase
    .from("reservations")
    .update({
      payment_provider: "stripe",
      payment_status: paymentStatus,
    })
    .eq("id", reservationId);

  if (error) {
    throw error;
  }
}

function getFailureNote(paymentIntent: Stripe.PaymentIntent, eventId: string) {
  const message = paymentIntent.last_payment_error?.message?.trim();

  return message
    ? `Stripe payment failed (${eventId}): ${message}`
    : `Stripe payment failed (${eventId}).`;
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = getStripeWebhookSecret();
  const supabase = buildServiceSupabaseClient();

  if (!stripe || !webhookSecret || !supabase) {
    return NextResponse.json({ ok: true, skipped: true }, { status: 200 });
  }

  const signature = req.headers.get("stripe-signature")?.trim();

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature." }, { status: 400 });
  }

  const payload = await req.text();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Invalid Stripe webhook signature.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const reservationId =
        getReservationIdFromMetadata(session.metadata) ||
        parseReservationId(session.client_reference_id);

      if (!reservationId) {
        console.error("Stripe webhook missing reservationId for checkout.session.completed", event.id);
        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
      }

      await updateReservationPayment(supabase, reservationId, "paid");
      await recordPaymentEvent(
        supabase,
        reservationId,
        "payment_stripe_paid",
        `Stripe checkout completed (${event.id}, ${session.id}).`
      );
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const reservationId =
        getReservationIdFromMetadata(session.metadata) ||
        parseReservationId(session.client_reference_id);

      if (!reservationId) {
        console.error("Stripe webhook missing reservationId for checkout.session.expired", event.id);
        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
      }

      await updateReservationPayment(supabase, reservationId, "failed");
      await recordPaymentEvent(
        supabase,
        reservationId,
        "payment_expired",
        `Stripe checkout expired (${event.id}, ${session.id}).`
      );
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const reservationId = getReservationIdFromMetadata(paymentIntent.metadata);

      if (!reservationId) {
        console.error("Stripe webhook missing reservationId for payment_intent.payment_failed", event.id);
        return NextResponse.json({ ok: true, ignored: true }, { status: 200 });
      }

      await updateReservationPayment(supabase, reservationId, "failed");
      await recordPaymentEvent(
        supabase,
        reservationId,
        "payment_stripe_failed",
        getFailureNote(paymentIntent, event.id)
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Stripe webhook processing failed:", error);

    const message =
      error instanceof Error ? error.message : "Stripe webhook processing failed.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
