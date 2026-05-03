import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

type ReservationRow = {
  id: number;
  item_id: number;
  renter_id: string | null;
  date_from: string;
  date_to: string;
  status: string | null;
  payment_status: string | null;
  payment_due_at: string | null;
  rental_amount_snapshot: number | null;
  deposit_amount_snapshot: number | null;
};

type CheckoutRequestBody = {
  reservationId?: number | string | null;
  reservation_id?: number | string | null;
};

type ItemRow = {
  id: number;
  title: string | null;
  price_per_day: number | null;
  owner_id: string;
};

const STRIPE_SESSION_TIMEOUT_MS = 10_000;

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
    throw new Error("Supabase nie je nakonfigurovany.");
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

function parseReservationId(body: CheckoutRequestBody | null) {
  const rawValue = body?.reservationId ?? body?.reservation_id;
  const reservationId = Number(rawValue);

  if (!Number.isInteger(reservationId) || reservationId <= 0) {
    return null;
  }

  return reservationId;
}

function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const parsed = Date.UTC(year, month - 1, day);
  return Number.isFinite(parsed) ? parsed : null;
}

function getReservationDays(dateFrom: string, dateTo: string) {
  const fromUtc = parseDateOnly(dateFrom);
  const toUtc = parseDateOnly(dateTo);

  if (fromUtc === null || toUtc === null) {
    return null;
  }

  const msPerDay = 24 * 60 * 60 * 1000;
  const diff = Math.floor((toUtc - fromUtc) / msPerDay) + 1;

  return diff > 0 ? diff : null;
}

function isValidSnapshotAmount(value: number | null) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

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

function buildCheckoutUrls(req: NextRequest, reservationId: number) {
  const siteUrl = resolveSiteUrl(req);

  return {
    successUrl: `${siteUrl}/payment?reservation_id=${reservationId}&success=1`,
    cancelUrl: `${siteUrl}/payment?reservation_id=${reservationId}&cancel=1`,
  };
}

function logCheckoutStage(stage: string, reservationId: number | null, extra?: Record<string, unknown>) {
  console.log(stage, {
    reservationId,
    ...extra,
  });
}

function logCheckoutError(
  reservationId: number | null,
  stage: string,
  error: unknown,
  extra?: Record<string, unknown>
) {
  const message = error instanceof Error ? error.message : "Unknown checkout error.";

  console.error("checkout:error", {
    reservationId,
    stage,
    message,
    ...extra,
  });
}

function createStripeTimeoutError() {
  const error = new Error("Stripe checkout timeout.");
  error.name = "StripeCheckoutTimeoutError";
  return error;
}

async function createStripeSessionWithTimeout(
  sessionPromise: ReturnType<NonNullable<ReturnType<typeof getStripe>>["checkout"]["sessions"]["create"]>
) {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      sessionPromise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(createStripeTimeoutError());
        }, STRIPE_SESSION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function POST(req: NextRequest) {
  let reservationIdForLog: number | null = null;
  let currentStage = "checkout:start";
  logCheckoutStage(currentStage, reservationIdForLog);

  try {
    const body = (await req.json().catch(() => null)) as CheckoutRequestBody | null;
    const reservationId = parseReservationId(body);
    reservationIdForLog = reservationId;

    const authorization = req.headers.get("authorization")?.trim();
    if (!authorization) {
      return NextResponse.json({ error: "Chyba prihlasenie." }, { status: 401 });
    }

    if (!reservationId) {
      return NextResponse.json({ error: "Neplatne reservationId." }, { status: 400 });
    }

    const supabase = buildSupabaseClient(req);
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "Chyba prihlasenie." }, { status: 401 });
    }
    currentStage = "checkout:user_ok";
    logCheckoutStage(currentStage, reservationIdForLog);

    const { data: reservationData, error: reservationError } = await supabase
      .from("reservations")
      .select(
        "id,item_id,renter_id,date_from,date_to,status,payment_status,payment_due_at,rental_amount_snapshot,deposit_amount_snapshot"
      )
      .eq("id", reservationId)
      .maybeSingle();

    if (reservationError) {
      return NextResponse.json(
        { error: "Nepodarilo sa nacitat rezervaciu." },
        { status: 500 }
      );
    }

    const reservation = (reservationData ?? null) as ReservationRow | null;

    if (!reservation) {
      return NextResponse.json({ error: "Rezervacia neexistuje." }, { status: 404 });
    }

    if (reservation.renter_id && reservation.renter_id !== user.id) {
      return NextResponse.json({ error: "K rezervacii nemas pristup." }, { status: 403 });
    }
    currentStage = "checkout:reservation_ok";
    logCheckoutStage(currentStage, reservationIdForLog);

    const { data: overlappingRows, error: overlapError } = await supabase
      .from("reservations")
      .select("id,item_id,renter_id,date_from,date_to,status,payment_status,payment_due_at")
      .eq("item_id", reservation.item_id)
      .neq("id", reservation.id)
      .lte("date_from", reservation.date_to)
      .gte("date_to", reservation.date_from);

    if (overlapError) {
      return NextResponse.json(
        { error: "Nepodarilo sa overit dostupnost terminu." },
        { status: 500 }
      );
    }

    const blockingOverlap = ((overlappingRows ?? []) as ReservationRow[]).find(isBlockingReservation);

    if (blockingOverlap) {
      return NextResponse.json(
        {
          available: false,
          error:
            "Zvoleny termin uz nie je volny. Rezervacia bola medzitym obsadena inym pouzivatelom.",
        },
        { status: 409 }
      );
    }
    currentStage = "checkout:overlap_ok";
    logCheckoutStage(currentStage, reservationIdForLog);

    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select("id,title,price_per_day,owner_id")
      .eq("id", reservation.item_id)
      .maybeSingle();

    if (itemError) {
      return NextResponse.json(
        { error: "Nepodarilo sa nacitat cenu polozky." },
        { status: 500 }
      );
    }

    const item = (itemData ?? null) as ItemRow | null;

    if (!item) {
      return NextResponse.json({ error: "Polozka rezervacie neexistuje." }, { status: 404 });
    }

    if (item.owner_id === user.id) {
      return NextResponse.json(
        { error: "Vlastnu polozku nie je mozne rezervovat ani zaplatit." },
        { status: 403 }
      );
    }

    currentStage = "checkout:item_ok";
    logCheckoutStage(currentStage, reservationIdForLog);

    const snapshotAmount = isValidSnapshotAmount(reservation.rental_amount_snapshot)
      ? reservation.rental_amount_snapshot
      : null;
    let checkoutAmount = snapshotAmount;
    let reservationDays: number | null = null;

    if (checkoutAmount === null) {
      reservationDays = getReservationDays(reservation.date_from, reservation.date_to);
      const pricePerDay = Number(item.price_per_day);

      if (!reservationDays || !Number.isFinite(pricePerDay) || pricePerDay <= 0) {
        return NextResponse.json(
          { error: "Nepodarilo sa urcit cenu rezervacie." },
          { status: 400 }
        );
      }

      checkoutAmount = pricePerDay * reservationDays;
    }

    const unitAmount = Math.round(checkoutAmount * 100);

    if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
      return NextResponse.json(
        { error: "Nepodarilo sa pripravit platbu pre tuto rezervaciu." },
        { status: 400 }
      );
    }

    if (!isStripeConfigured()) {
      return NextResponse.json({
        ok: true,
        available: true,
        demo: true,
        fallback: true,
        reason: "stripe_not_configured",
      });
    }

    const stripe = getStripe();

    if (!stripe) {
      return NextResponse.json({
        ok: true,
        available: true,
        demo: true,
        fallback: true,
        reason: "stripe_not_configured",
      });
    }
    currentStage = "checkout:stripe_config_ok";
    logCheckoutStage(currentStage, reservationIdForLog);

    const { successUrl, cancelUrl } = buildCheckoutUrls(req, reservation.id);
    const metadata: Record<string, string> = {
      reservationId: String(reservation.id),
      itemId: String(reservation.item_id),
      renterId: reservation.renter_id ?? user.id,
    };

    currentStage = "checkout:stripe_session_create_start";
    logCheckoutStage(currentStage, reservationIdForLog);

    const session = await createStripeSessionWithTimeout(
      stripe.checkout.sessions.create({
        mode: "payment",
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: String(reservation.id),
        metadata,
        payment_intent_data: {
          metadata,
        },
        customer_email: user.email ?? undefined,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "eur",
              unit_amount: unitAmount,
              product_data: {
                name: item.title?.trim() || `Rezervacia #${reservation.id}`,
                description:
                  reservationDays && reservationDays > 0
                    ? `${reservation.date_from} az ${reservation.date_to} (${reservationDays} dni)`
                    : `${reservation.date_from} az ${reservation.date_to}`,
              },
            },
          },
        ],
      })
    );
    currentStage = "checkout:stripe_session_create_ok";
    logCheckoutStage(currentStage, reservationIdForLog, {
      sessionId: session.id,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Stripe neposkytol checkout URL." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      available: true,
      live: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "StripeCheckoutTimeoutError") {
      logCheckoutError(reservationIdForLog, currentStage, error);
      return NextResponse.json({ error: "Stripe checkout timeout." }, { status: 504 });
    }

    logCheckoutError(reservationIdForLog, currentStage, error);

    const message =
      error instanceof Error ? error.message : "Nepodarilo sa pripravit checkout.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
