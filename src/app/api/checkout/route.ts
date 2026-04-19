import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type ReservationRow = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  status: string | null;
  payment_status: string | null;
  payment_due_at: string | null;
};

const NON_BLOCKING_RESERVATION_STATUSES = new Set([
  "cancelled",
  "canceled",
  "rejected",
  "completed",
  "returned",
  "expired",
  "zrusene",
  "zamietnute",
  "ukoncene",
  "vratene",
]);

function buildSupabaseClient(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase nie je nakonfigurovaný.");
  }

  const authorization = req.headers.get("authorization")?.trim();

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: authorization
      ? {
          headers: {
            Authorization: authorization,
          },
        }
      : undefined,
  });
}

function isBlockingReservation(reservation: ReservationRow) {
  const normalizedStatus = (reservation.status ?? "").trim().toLowerCase();
  const normalizedPaymentStatus = (reservation.payment_status ?? "").trim().toLowerCase();

  if (NON_BLOCKING_RESERVATION_STATUSES.has(normalizedStatus)) {
    return false;
  }

  if (normalizedPaymentStatus === "failed") {
    return false;
  }

  return true;
}

export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get("authorization")?.trim();
    if (!authorization) {
      return NextResponse.json({ error: "Chýba prihlásenie." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as { reservationId?: number } | null;
    const reservationId = Number(body?.reservationId);

    if (!Number.isInteger(reservationId) || reservationId <= 0) {
      return NextResponse.json({ error: "Neplatné reservationId." }, { status: 400 });
    }

    const supabase = buildSupabaseClient(req);

    const { data: reservationData, error: reservationError } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_due_at")
      .eq("id", reservationId)
      .maybeSingle();

    if (reservationError) {
      return NextResponse.json(
        { error: "Nepodarilo sa načítať rezerváciu." },
        { status: 500 }
      );
    }

    const reservation = (reservationData ?? null) as ReservationRow | null;

    if (!reservation) {
      return NextResponse.json({ error: "Rezervácia neexistuje." }, { status: 404 });
    }

    const { data: overlappingRows, error: overlapError } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_due_at")
      .eq("item_id", reservation.item_id)
      .neq("id", reservation.id)
      .lte("date_from", reservation.date_to)
      .gte("date_to", reservation.date_from);

    if (overlapError) {
      return NextResponse.json(
        { error: "Nepodarilo sa overiť dostupnosť termínu." },
        { status: 500 }
      );
    }

    const blockingOverlap = ((overlappingRows ?? []) as ReservationRow[]).find(isBlockingReservation);

    if (blockingOverlap) {
      return NextResponse.json(
        {
          available: false,
          error:
            "Zvolený termín už nie je voľný. Rezervácia bola medzitým obsadená iným používateľom.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      ok: true,
      available: true,
      demo: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nepodarilo sa overiť dostupnosť termínu.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
