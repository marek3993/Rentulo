"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ReservationRow = {
  id: number;
  item_id: number;
  renter_id: string;
  date_from: string;
  date_to: string;
  status: string;
  payment_status: string;
};

type ItemRow = {
  id: number;
  title: string;
  owner_id: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function NewDisputePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const reservationIdParam = Number(searchParams.get("reservation_id") || "");

  const [status, setStatus] = useState("Načítavam...");
  const [saving, setSaving] = useState(false);

  const [reservation, setReservation] = useState<ReservationRow | null>(null);
  const [item, setItem] = useState<ItemRow | null>(null);

  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");

  const reasonOptions = useMemo(
    () => [
      "Poškodená vec",
      "Vec nezodpovedá popisu",
      "Chýbajúce príslušenstvo",
      "Problém pri odovzdaní",
      "Problém pri vrátení",
      "Prenajímateľ nereaguje",
      "Iný problém",
    ],
    []
  );

  useEffect(() => {
    const run = async () => {
      setStatus("Načítavam...");

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      if (!Number.isFinite(reservationIdParam)) {
        setStatus("Chýba rezervácia.");
        return;
      }

      const { data: reservationData, error: reservationError } = await supabase
        .from("reservations")
        .select("id,item_id,renter_id,date_from,date_to,status,payment_status")
        .eq("id", reservationIdParam)
        .maybeSingle();

      if (reservationError) {
        setStatus("Chyba: " + reservationError.message);
        return;
      }

      if (!reservationData) {
        setStatus("Rezervácia neexistuje.");
        return;
      }

      const typedReservation = reservationData as ReservationRow;

      if (typedReservation.renter_id !== userId) {
        setStatus("Nemáš prístup k tejto rezervácii.");
        return;
      }

      if (
        typedReservation.status !== "confirmed" &&
        typedReservation.status !== "in_rental" &&
        typedReservation.status !== "return_pending_confirmation" &&
        typedReservation.status !== "disputed"
      ) {
        setStatus("Spor je možné nahlásiť len pri aktívnej rezervácii.");
        return;
      }

      setReservation(typedReservation);

      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id,title,owner_id")
        .eq("id", typedReservation.item_id)
        .maybeSingle();

      if (itemError) {
        setStatus("Chyba: " + itemError.message);
        return;
      }

      if (!itemData) {
        setStatus("Položka neexistuje.");
        return;
      }

      setItem(itemData as ItemRow);
      setStatus("");
    };

    run();
  }, [reservationIdParam, router]);

  const submitDispute = async () => {
    if (!reservation || !item) return;

    if (!reason.trim()) {
      alert("Vyber dôvod problému.");
      setStatus("Vyber dôvod problému.");
      return;
    }

    setSaving(true);
    setStatus("Ukladám spor...");

    const { error } = await supabase.rpc("dispute_open", {
      p_reservation_id: reservation.id,
      p_reason: reason.trim(),
      p_details: details.trim() ? details.trim() : null,
    });

    if (error) {
      setSaving(false);
      setStatus("Chyba: " + error.message);
      alert(error.message);
      return;
    }

    setSaving(false);
    setStatus("Spor bol úspešne odoslaný ✅");
    alert("Spor bol úspešne odoslaný.");
    router.push("/disputes");
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Nahlásiť problém</h1>
            <p className="mt-1 text-white/60">
              Použi len pri reálnom probléme s prenájmom, odovzdaním alebo vrátením.
            </p>
          </div>

          <Link
            href="/reservations"
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
          >
            Späť na rezervácie
          </Link>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      {reservation && item ? (
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1.4fr]">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
            <div className="font-semibold">Rezervácia</div>

            <div className="text-white/80">
              <span className="text-white/50">ID rezervácie:</span> #{reservation.id}
            </div>

            <div className="text-white/80">
              <span className="text-white/50">Položka:</span> {item.title}
            </div>

            <div className="text-white/80">
              <span className="text-white/50">Termín:</span> {formatDate(reservation.date_from)} →{" "}
              {formatDate(reservation.date_to)}
            </div>

            <div className="text-white/80">
              <span className="text-white/50">Stav rezervácie:</span> {reservation.status}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
            <div className="font-semibold">Detaily problému</div>

            <label className="block">
              <div className="mb-1 text-white/80">Dôvod</div>
              <select
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={saving}
              >
                <option value="">Vyber dôvod</option>
                {reasonOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-white/80">Popis problému</div>
              <textarea
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                rows={7}
                placeholder="Stručne a vecne opíš, čo sa stalo."
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={saving}
              />
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                onClick={submitDispute}
                disabled={saving}
              >
                {saving ? "Odosielam..." : "Odoslať spor"}
              </button>

              <Link
                href="/reservations"
                className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              >
                Zrušiť
              </Link>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function NewDisputePage() {
  return (
    <Suspense
      fallback={
        <main className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            Načítavam...
          </div>
        </main>
      }
    >
      <NewDisputePageInner />
    </Suspense>
  );
}
