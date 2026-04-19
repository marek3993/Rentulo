"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ReservationRow = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  payment_status: string | null;
  payment_provider: string | null;
  payment_due_at: string | null;
  status: string | null;
};

type CheckoutAvailabilityResponse = {
  available?: boolean;
  error?: string;
};

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("sk-SK");
}

function PaymentInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const reservationIdRaw = sp.get("reservation_id");
  const reservationId = reservationIdRaw ? Number(reservationIdRaw) : NaN;

  const [status, setStatus] = useState("Načítavam platbu...");
  const [reservation, setReservation] = useState<ReservationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [availabilityChecking, setAvailabilityChecking] = useState(false);

  const loadReservation = async () => {
    if (!Number.isFinite(reservationId)) return null;

    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,payment_status,payment_provider,payment_due_at,status")
      .eq("id", reservationId)
      .maybeSingle();

    if (error) return null;

    const row = (data ?? null) as ReservationRow | null;
    setReservation(row);
    return row;
  };

  const recheckAvailability = async (loadingStatus: string) => {
    if (!Number.isFinite(reservationId)) {
      const nextError = "Chýba reservation_id.";
      setAvailabilityError(nextError);
      setStatus(nextError);
      return false;
    }

    setAvailabilityChecking(true);
    setStatus(loadingStatus);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        const nextError = "Pre pokračovanie sa musíš prihlásiť.";
        setAvailabilityError(nextError);
        setStatus(nextError);
        return false;
      }

      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reservationId }),
      });

      const payload = (await res.json().catch(() => null)) as CheckoutAvailabilityResponse | null;

      if (!res.ok) {
        const nextError =
          payload?.error ??
          (res.status === 409
            ? "Zvolený termín už nie je voľný. Vyber si prosím iný termín."
            : "Nepodarilo sa overiť dostupnosť termínu.");

        setAvailabilityError(nextError);
        setStatus(nextError);
        return false;
      }

      setAvailabilityError("");
      return true;
    } catch {
      const nextError = "Nepodarilo sa overiť dostupnosť termínu. Skús to znova.";
      setAvailabilityError(nextError);
      setStatus(nextError);
      return false;
    } finally {
      setAvailabilityChecking(false);
    }
  };

  const insertNotification = async (
    userId: string,
    title: string,
    body: string,
    link: string
  ) => {
    await supabase.from("notifications").insert({
      user_id: userId,
      type: "payment",
      title,
      body,
      link,
      is_read: false,
    });
  };

  useEffect(() => {
    const run = async () => {
      if (!Number.isFinite(reservationId)) {
        setStatus("Chýba reservation_id.");
        return;
      }

      const row = await loadReservation();

      if (!row) {
        setStatus("Rezervácia neexistuje.");
        return;
      }

      if (row.payment_status === "paid") {
        setStatus("Táto rezervácia je už zaplatená ✅");
        return;
      }

      if (row.status === "cancelled" && row.payment_status === "failed") {
        setStatus("Táto platba už expirovala alebo zlyhala.");
        return;
      }

      const available = await recheckAvailability("Kontrolujem dostupnosť termínu...");
      if (!available) {
        return;
      }

      setStatus("Demo režim: vyber výsledok platby.");
    };

    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservationId]);

  const markPaidDemo = async () => {
    if (!Number.isFinite(reservationId) || busy) return;

    setBusy(true);

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      setBusy(false);
      router.push("/login");
      return;
    }

    const available = await recheckAvailability(
      "Kontrolujem dostupnosť termínu pred pokračovaním..."
    );

    if (!available) {
      setBusy(false);
      return;
    }

    setStatus("Označujem ako zaplatené (demo)...");

    const currentReservation = await loadReservation();
    if (!currentReservation) {
      setStatus("Chyba: rezervácia neexistuje.");
      setBusy(false);
      return;
    }

    const { error } = await supabase.rpc("payment_record_event", {
      p_reservation_id: reservationId,
      p_provider: "demo",
      p_event_type: "payment_demo_paid",
      p_note: "Používateľ simuloval úspešnú demo platbu.",
    });

    if (error) {
      setStatus("Chyba: " + error.message);
      setBusy(false);
      return;
    }

    const { data: itemRow } = await supabase
      .from("items")
      .select("owner_id,title")
      .eq("id", currentReservation.item_id)
      .maybeSingle();

    if (itemRow?.owner_id) {
      await insertNotification(
        itemRow.owner_id,
        "Platba prijatá",
        `Rezervácia #${reservationId} bola zaplatená.`,
        "/owner/reservations"
      );
    }

    await insertNotification(
      userId,
      "Platba úspešná",
      `Rezervácia #${reservationId} bola úspešne zaplatená.`,
      "/reservations"
    );

    setStatus("Platba úspešná ✅ (demo)");
    router.replace("/reservations");
  };

  const markFailedDemo = async () => {
    if (!Number.isFinite(reservationId) || busy) return;

    setBusy(true);
    setStatus("Simulujem zlyhanie platby...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      setBusy(false);
      router.push("/login");
      return;
    }

    const { error } = await supabase.rpc("payment_record_event", {
      p_reservation_id: reservationId,
      p_provider: "demo",
      p_event_type: "payment_demo_failed",
      p_note: "Používateľ simuloval zlyhanie demo platby.",
    });

    if (error) {
      setStatus("Chyba: " + error.message);
      setBusy(false);
      return;
    }

    await insertNotification(
      userId,
      "Platba zlyhala",
      `Platba pre rezerváciu #${reservationId} zlyhala.`,
      "/reservations"
    );

    setStatus("Platba zlyhala (demo)");
    router.replace("/reservations");
  };

  const showActions =
    Number.isFinite(reservationId) &&
    !!reservation &&
    !availabilityError &&
    !availabilityChecking &&
    reservation.payment_status !== "paid" &&
    !(reservation.status === "cancelled" && reservation.payment_status === "failed");

  const itemDetailHref = useMemo(() => {
    if (!reservation) return null;

    const params = new URLSearchParams();
    if (reservation.date_from) params.set("date_from", reservation.date_from);
    if (reservation.date_to) params.set("date_to", reservation.date_to);

    const query = params.toString();
    return query ? `/items/${reservation.item_id}?${query}` : `/items/${reservation.item_id}`;
  }, [reservation]);

  return (
    <main className="max-w-xl">
      <h1 className="text-2xl font-semibold">Platba</h1>

      <p className="mt-4">
        Rezervácia: <strong>#{reservationIdRaw ?? "-"}</strong>
      </p>

      {reservation?.payment_due_at ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          Platbu treba dokončiť do:{" "}
          <strong className="text-white">
            {formatDateTime(reservation.payment_due_at)}
          </strong>
        </div>
      ) : null}

      {availabilityError ? (
        <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="font-semibold">Termín už nie je voľný.</div>
          <div className="mt-1">{availabilityError}</div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="font-medium">{status}</p>

        <div className="mt-4 text-sm text-white/70">
          Aktívny je iba demo payment flow. Stripe sa bude riešiť neskôr.
        </div>

        {availabilityChecking ? (
          <div className="mt-4 text-sm text-white/60">
            Prebieha kontrola dostupnosti termínu...
          </div>
        ) : null}

        {showActions ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={markPaidDemo}
              type="button"
              disabled={busy}
            >
              Simulovať úspešnú platbu
            </button>

            <button
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={markFailedDemo}
              type="button"
              disabled={busy}
            >
              Simulovať zlyhanie
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex gap-4">
        {itemDetailHref ? (
          <Link className="underline" href={itemDetailHref}>
            Späť na detail položky
          </Link>
        ) : (
          <Link className="underline" href="/items">
            Späť na ponuky
          </Link>
        )}
        <Link className="underline" href="/reservations">
          Moje rezervácie
        </Link>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<main className="p-8">Načítavam platbu...</main>}>
      <PaymentInner />
    </Suspense>
  );
}
