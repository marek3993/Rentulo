import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2026-01-28.clover",
    })
  : null;

function calcDaysInclusive(dateFrom: string, dateTo: string) {
  const msPerDay = 24 * 60 * 60 * 1000;
  const d1 = new Date(dateFrom).getTime();
  const d2 = new Date(dateTo).getTime();
  if (!Number.isFinite(d1) || !Number.isFinite(d2)) return 0;
  return Math.max(0, Math.floor((d2 - d1) / msPerDay) + 1);
}

export async function POST(req: Request) {
  try {
    if (!stripe || !siteUrl) {
      return NextResponse.json(
        { error: "Stripe nie je nastavený." },
        { status: 501 }
      );
    }

    const body = await req.json();
    const reservationId = Number(body?.reservation_id);

    if (!Number.isFinite(reservationId)) {
      return NextResponse.json(
        { error: "Neplatné reservation_id." },
        { status: 400 }
      );
    }

    const { data: reservation, error: reservationError } = await supabaseAdmin
      .from("reservations")
      .select("id,item_id,renter_id,date_from,date_to,payment_status,status")
      .eq("id", reservationId)
      .maybeSingle();

    if (reservationError || !reservation) {
      return NextResponse.json(
        { error: "Rezervácia neexistuje." },
        { status: 404 }
      );
    }

    if (reservation.payment_status === "paid") {
      return NextResponse.json(
        { error: "Rezervácia je už zaplatená." },
        { status: 400 }
      );
    }

    if (reservation.status === "cancelled") {
      return NextResponse.json(
        { error: "Zrušenú rezerváciu nie je možné zaplatiť." },
        { status: 400 }
      );
    }

    const { data: item, error: itemError } = await supabaseAdmin
      .from("items")
      .select("id,title,price_per_day")
      .eq("id", reservation.item_id)
      .maybeSingle();

    if (itemError || !item) {
      return NextResponse.json(
        { error: "Položka neexistuje." },
        { status: 404 }
      );
    }

    const days = calcDaysInclusive(reservation.date_from, reservation.date_to);
    if (days <= 0) {
      return NextResponse.json(
        { error: "Neplatný rozsah rezervácie." },
        { status: 400 }
      );
    }

    const unitAmount = Math.round(Number(item.price_per_day) * 100);
    const totalAmount = unitAmount * days;

    if (!Number.isFinite(unitAmount) || unitAmount <= 0 || totalAmount <= 0) {
      return NextResponse.json(
        { error: "Neplatná cena rezervácie." },
        { status: 400 }
      );
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      success_url: `${siteUrl}/payment?reservation_id=${reservation.id}&success=1`,
      cancel_url: `${siteUrl}/payment?reservation_id=${reservation.id}&cancel=1`,
      client_reference_id: String(reservation.id),
      metadata: {
        reservation_id: String(reservation.id),
        item_id: String(reservation.item_id),
        renter_id: String(reservation.renter_id),
        days: String(days),
      },
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: item.title,
              description: `Rezervácia #${reservation.id} · ${days} dní`,
            },
            unit_amount: unitAmount,
          },
          quantity: days,
        },
      ],
    });

    await supabaseAdmin
      .from("reservations")
      .update({
        payment_provider: "stripe",
      })
      .eq("id", reservation.id);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Neznáma chyba.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}