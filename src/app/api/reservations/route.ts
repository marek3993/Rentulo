import { NextRequest, NextResponse } from "next/server";

import { buildServiceSupabaseClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type CreateReservationRequestBody = {
  itemId?: number | string | null;
  item_id?: number | string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  date_from?: string | null;
  date_to?: string | null;
};

type ItemRow = {
  id: number;
  owner_id: string;
};

type ReservationInsertRow = {
  id: number;
  rental_amount_snapshot: number | null;
  deposit_amount_snapshot: number | null;
};

function getBearerToken(req: NextRequest) {
  const header = req.headers.get("authorization")?.trim() ?? "";

  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  const token = header.slice(7).trim();
  return token || null;
}

function parseItemId(body: CreateReservationRequestBody | null) {
  const itemId = Number(body?.itemId ?? body?.item_id);

  if (!Number.isInteger(itemId) || itemId <= 0) {
    return null;
  }

  return itemId;
}

function parseDateOnly(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }

  const parsed = Date.UTC(year, month - 1, day);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseReservationDates(body: CreateReservationRequestBody | null) {
  const dateFrom = body?.dateFrom ?? body?.date_from ?? null;
  const dateTo = body?.dateTo ?? body?.date_to ?? null;

  if (!dateFrom || !dateTo) {
    return null;
  }

  const fromUtc = parseDateOnly(dateFrom);
  const toUtc = parseDateOnly(dateTo);

  if (fromUtc === null || toUtc === null || toUtc < fromUtc) {
    return null;
  }

  return { dateFrom, dateTo };
}

async function ensureProfileExists(userId: string, supabase: NonNullable<ReturnType<typeof buildServiceSupabaseClient>>) {
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    throw new Error("Kontrola profilu zlyhala.");
  }

  if (profile) {
    return;
  }

  const { error: insertProfileError } = await supabase.from("profiles").insert({ id: userId });

  if (insertProfileError) {
    throw new Error("Vytvorenie profilu zlyhalo.");
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = buildServiceSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: "Server nie je spravne nakonfigurovany pre rezervacie." },
        { status: 500 }
      );
    }

    const token = getBearerToken(req);

    if (!token) {
      return NextResponse.json({ error: "Chyba prihlasenie." }, { status: 401 });
    }

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return NextResponse.json({ error: "Chyba prihlasenie." }, { status: 401 });
    }

    const body = (await req.json().catch(() => null)) as CreateReservationRequestBody | null;
    const itemId = parseItemId(body);
    const reservationDates = parseReservationDates(body);

    if (!itemId) {
      return NextResponse.json({ error: "Neplatne itemId." }, { status: 400 });
    }

    if (!reservationDates) {
      return NextResponse.json({ error: "Neplatny termin rezervacie." }, { status: 400 });
    }

    const { data: itemData, error: itemError } = await supabase
      .from("items")
      .select("id,owner_id")
      .eq("id", itemId)
      .maybeSingle();

    if (itemError) {
      return NextResponse.json({ error: "Nepodarilo sa nacitat polozku." }, { status: 500 });
    }

    const item = (itemData ?? null) as ItemRow | null;

    if (!item) {
      return NextResponse.json({ error: "Polozka neexistuje." }, { status: 404 });
    }

    if (item.owner_id === user.id) {
      return NextResponse.json(
        { error: "Vlastnu polozku si nemozes rezervovat." },
        { status: 403 }
      );
    }

    await ensureProfileExists(user.id, supabase);

    const { data: reservationData, error: reservationError } = await supabase
      .from("reservations")
      .insert({
        item_id: itemId,
        renter_id: user.id,
        date_from: reservationDates.dateFrom,
        date_to: reservationDates.dateTo,
        status: "pending",
        payment_provider: "none",
        payment_status: "unpaid",
      })
      .select("id,rental_amount_snapshot,deposit_amount_snapshot")
      .single();

    if (reservationError) {
      if (reservationError.message.includes("overlaps")) {
        return NextResponse.json(
          { error: "Tato polozka je uz rezervovana v zadanom termine." },
          { status: 409 }
        );
      }

      return NextResponse.json({ error: "Nepodarilo sa vytvorit rezervaciu." }, { status: 500 });
    }

    return NextResponse.json({
      reservation: (reservationData ?? null) as ReservationInsertRow | null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nepodarilo sa vytvorit rezervaciu.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
