import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { supabase } from "@/lib/supabaseClient";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing Stripe-Signature" }, { status: 400 });

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;
  const rawBody = await req.text(); // dôležité: raw body pre verifikáciu :contentReference[oaicite:1]{index=1}

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err.message}` }, { status: 400 });
  }

  // Spracuj eventy
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const reservationId = session.metadata?.reservation_id;

    if (reservationId) {
      await supabase
        .from("reservations")
        .update({ status: "confirmed", payment_status: "paid" })
        .eq("id", Number(reservationId));
    }
  }

  return NextResponse.json({ received: true });
}
