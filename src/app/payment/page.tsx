"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type ReservationRow = {
  id: number;
  item_id: number;
  payment_status: string | null;
  payment_provider: string | null;
  payment_due_at: string | null;
  status: string | null;
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

  const loadReservation = async () => {
    if (!Number.isFinite(reservationId)) return null;

    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,payment_status,payment_provider,payment_due_at,status")
      .eq("id", reservationId)
      .maybeSingle();

    if (error) return null;

    const row = (data ?? null) as ReservationRow | null;
    setReservation(row);
    return row;
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

      setStatus("Demo režim: vyber výsledok platby.");
    };

    run();
  }, [reservationId]);

  const markPaidDemo = async () => {
    if (!Number.isFinite(reservationId) || busy) return;

    setBusy(true);
    setStatus("Označujem ako zaplatené (demo)...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

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
    reservation.payment_status !== "paid" &&
    !(reservation.status === "cancelled" && reservation.payment_status === "failed");

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

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="font-medium">{status}</p>

        <div className="mt-4 text-sm text-white/70">
          Aktívny je iba demo payment flow. Stripe sa bude riešiť neskôr.
        </div>

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
        <Link className="underline" href="/items">
          Späť na ponuky
        </Link>
        <Link className="underline" href="/reservations">
          Moje rezervácie
        </Link>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<main className="p-8">Načítavam platbu…</main>}>
      <PaymentInner />
    </Suspense>
  );
}
