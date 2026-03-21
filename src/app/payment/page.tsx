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
  const success = sp.get("success");
  const cancel = sp.get("cancel");

  const [status, setStatus] = useState("Pripravujem platbu...");
  const [mode, setMode] = useState<"loading" | "stripe" | "demo">("loading");
  const [reservation, setReservation] = useState<ReservationRow | null>(null);

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

  const insertPaymentEvent = async (
    actorUserId: string,
    eventType: string,
    note: string
  ) => {
    await supabase.from("payment_events").insert({
      reservation_id: reservationId,
      actor_user_id: actorUserId,
      event_type: eventType,
      provider: "demo",
      note,
      currency: "EUR",
    });
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
        setMode("demo");
        return;
      }

      const row = await loadReservation();

      if (row?.status === "cancelled" && row?.payment_status === "failed") {
        setStatus("Táto platba už expirovala alebo zlyhala.");
        setMode("demo");
        return;
      }

      if (row?.payment_status === "paid") {
        setStatus("Táto rezervácia je už zaplatená ✅");
        setMode("demo");
        return;
      }

      if (success === "1") {
        setStatus("Platba prebehla. Kontrolujem stav...");
        if (row?.payment_status === "paid") {
          setStatus("Platba úspešná ✅");
          setTimeout(() => router.push("/reservations"), 1000);
          return;
        }

        setStatus("Platba prebehla, ale potvrdenie ešte nedobehol.");
        setMode("stripe");
        return;
      }

      if (cancel === "1") {
        setStatus("Platba bola zrušená.");
        setMode("stripe");
        return;
      }

      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservation_id: reservationId }),
        });

        if (res.status === 501) {
          setStatus("Demo režim: Stripe nie je nastavený.");
          setMode("demo");
          return;
        }

        const json = await res.json();

        if (json?.url) {
          setMode("stripe");
          window.location.href = json.url;
          return;
        }

        setStatus(json?.error || "Chyba platby.");
        setMode("demo");
      } catch {
        setStatus("Demo režim: platobná brána nie je dostupná.");
        setMode("demo");
      }
    };

    run();
  }, [reservationId, router, success, cancel]);

  const markPaidDemo = async () => {
    if (!Number.isFinite(reservationId)) return;

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
      return;
    }

    const { error } = await supabase
      .from("reservations")
      .update({
        payment_provider: "demo",
        payment_status: "paid",
      })
      .eq("id", reservationId)
      .eq("renter_id", userId);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    await insertPaymentEvent(
      userId,
      "payment_demo_paid",
      "Používateľ simuloval úspešnú demo platbu."
    );

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
    router.push("/reservations");
  };

  const markFailedDemo = async () => {
    if (!Number.isFinite(reservationId)) return;

    setStatus("Simulujem zlyhanie platby...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("reservations")
      .update({
        payment_provider: "demo",
        payment_status: "failed",
      })
      .eq("id", reservationId)
      .eq("renter_id", userId);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    await insertPaymentEvent(
      userId,
      "payment_demo_failed",
      "Používateľ simuloval zlyhanie demo platby."
    );

    await insertNotification(
      userId,
      "Platba zlyhala",
      `Platba pre rezerváciu #${reservationId} zlyhala.`,
      "/reservations"
    );

    setStatus("Platba zlyhala (demo)");
    router.push("/reservations");
  };

  return (
    <main className="max-w-xl">
      <h1 className="text-2xl font-semibold">Platba</h1>

      <p className="mt-4">
        Rezervácia: <strong>#{reservationIdRaw ?? "-"}</strong>
      </p>

      {reservation?.payment_due_at ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          Platbu treba dokončiť do:{" "}
          <strong className="text-white">{formatDateTime(reservation.payment_due_at)}</strong>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="font-medium">{status}</p>

        {mode === "demo" ? (
          <div className="mt-4 space-y-3">
            <div className="text-sm text-white/70">Toto je testovací režim.</div>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                onClick={markPaidDemo}
                type="button"
                disabled={reservation?.payment_status === "paid"}
              >
                Simulovať úspešnú platbu
              </button>

              <button
                className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                onClick={markFailedDemo}
                type="button"
              >
                Simulovať zlyhanie
              </button>
            </div>
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