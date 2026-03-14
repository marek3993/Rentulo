"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ReservationStatus =
  | "pending"
  | "confirmed"
  | "in_rental"
  | "return_pending_confirmation"
  | "completed"
  | "cancelled"
  | "disputed"
  | string;

type PaymentStatus = "unpaid" | "paid" | "failed" | string;

type Reservation = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  payment_provider: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function daysUntil(dateStr: string) {
  const now = new Date();
  const target = new Date(dateStr);

  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function reservationBadge(status: ReservationStatus) {
  if (status === "pending") return "bg-yellow-400 text-black";
  if (status === "confirmed") return "bg-green-600/90 text-white";
  if (status === "in_rental") return "bg-blue-600/90 text-white";
  if (status === "return_pending_confirmation") return "bg-orange-500 text-white";
  if (status === "completed") return "bg-emerald-700 text-white";
  if (status === "cancelled") return "bg-red-600/90 text-white";
  if (status === "disputed") return "bg-purple-600/90 text-white";
  return "bg-white/10 text-white";
}

function paymentBadge(status: PaymentStatus) {
  if (status === "paid") return "bg-green-600/90 text-white";
  if (status === "failed") return "bg-red-600/90 text-white";
  return "bg-yellow-400 text-black";
}

function reservationStatusLabel(status: ReservationStatus) {
  if (status === "pending") return "Čaká na potvrdenie";
  if (status === "confirmed") return "Potvrdená";
  if (status === "in_rental") return "Prebieha prenájom";
  if (status === "return_pending_confirmation") return "Čaká na potvrdenie vrátenia";
  if (status === "completed") return "Dokončená";
  if (status === "cancelled") return "Zrušená";
  if (status === "disputed") return "V spore";
  return status;
}

function paymentStatusLabel(status: PaymentStatus) {
  if (status === "paid") return "Zaplatené";
  if (status === "failed") return "Platba zlyhala";
  return "Nezaplatené";
}

export default function ReservationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [status, setStatus] = useState("Načítavam...");

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_provider")
      .eq("renter_id", userId)
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setRows((data ?? []) as Reservation[]);
    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateReservationStatus = async (
    id: number,
    nextStatus: "return_pending_confirmation" | "cancelled" | "disputed"
  ) => {
    setStatus("Ukladám zmenu...");

    const { error } = await supabase
      .from("reservations")
      .update({ status: nextStatus })
      .eq("id", id);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    await load();
  };

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const confirmed = useMemo(() => rows.filter((r) => r.status === "confirmed"), [rows]);
  const inRental = useMemo(() => rows.filter((r) => r.status === "in_rental"), [rows]);
  const returnPending = useMemo(
    () => rows.filter((r) => r.status === "return_pending_confirmation"),
    [rows]
  );
  const completed = useMemo(() => rows.filter((r) => r.status === "completed"), [rows]);
  const disputed = useMemo(() => rows.filter((r) => r.status === "disputed"), [rows]);
  const cancelled = useMemo(() => rows.filter((r) => r.status === "cancelled"), [rows]);

  const SectionCard = ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
  }) => (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );

  const Card = ({ r }: { r: Reservation }) => {
    const canPay = r.status === "pending" && r.payment_status === "unpaid";
    const canCancel =
      r.status !== "cancelled" &&
      r.status !== "completed" &&
      r.status !== "in_rental" &&
      r.status !== "return_pending_confirmation";

    const canDispute =
      r.status === "confirmed" ||
      r.status === "in_rental" ||
      r.status === "return_pending_confirmation";

    const canMarkReturned = r.status === "in_rental";

    const startIn = daysUntil(r.date_from);
    const endIn = daysUntil(r.date_to);

    const countdownText =
      r.status === "cancelled"
        ? "Táto rezervácia je zrušená."
        : r.status === "completed"
        ? "Prenájom je úspešne ukončený."
        : startIn > 0
        ? `Začína o ${startIn} ${startIn === 1 ? "deň" : startIn < 5 ? "dni" : "dní"}.`
        : endIn >= 0
        ? "Prenájom práve prebieha alebo začína dnes."
        : "Termín už uplynul.";

    return (
      <li className="rounded-2xl border border-white/10 bg-black/20 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-white/50">Rezervácia</span>
              <strong className="text-base">#{r.id}</strong>
            </div>

            <div className="text-white/80">
              <span className="text-white/50">Položka:</span> {r.item_id}
            </div>

            <div className="text-white/80">
              <span className="text-white/50">Termín:</span> {formatDate(r.date_from)} →{" "}
              {formatDate(r.date_to)}
            </div>

            <div className="text-sm text-white/60">{countdownText}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${reservationBadge(
                r.status
              )}`}
            >
              {reservationStatusLabel(r.status)}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${paymentBadge(
                r.payment_status
              )}`}
            >
              {paymentStatusLabel(r.payment_status)}
            </span>
          </div>
        </div>

        <div className="mt-4 text-sm text-white/50">
          Poskytovateľ platby: {r.payment_provider}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {canPay ? (
            <Link
              className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
              href={`/payment?reservation_id=${r.id}`}
            >
              Dokončiť platbu
            </Link>
          ) : null}

          {canMarkReturned ? (
            <button
              className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
              onClick={() => updateReservationStatus(r.id, "return_pending_confirmation")}
              type="button"
            >
              Vrátil som
            </button>
          ) : null}

          {canDispute ? (
            <button
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              onClick={() => updateReservationStatus(r.id, "disputed")}
              type="button"
            >
              Nahlásiť problém
            </button>
          ) : null}

          {canCancel ? (
            <button
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              onClick={() => updateReservationStatus(r.id, "cancelled")}
              type="button"
            >
              Zrušiť rezerváciu
            </button>
          ) : null}

          <Link
            className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
            href={`/items/${r.item_id}`}
          >
            Detail ponuky
          </Link>
        </div>

        {r.status === "completed" ? (
          <div className="mt-3 text-sm text-white/60">
            Hodnotenie spravíme v ďalšom kroku po ukončení prenájmu.
          </div>
        ) : null}

        {r.status === "pending" && r.payment_status === "paid" ? (
          <div className="mt-3 text-sm text-white/60">
            Platba je zaevidovaná. Čaká sa na potvrdenie prenajímateľa.
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Moje rezervácie</h1>
            <p className="mt-1 text-white/60">
              Prehľad všetkých rezervácií podľa stavu a fázy prenájmu.
            </p>
          </div>

          <Link
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
            href="/items"
          >
            Prejsť na ponuky
          </Link>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      <SectionCard
        title="Čakajúce rezervácie"
        subtitle="Rezervácie čakajúce na potvrdenie alebo na platbu."
      >
        {pending.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne čakajúce rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Potvrdené rezervácie"
        subtitle="Rezervácie schválené prenajímateľom a pripravené na odovzdanie."
      >
        {confirmed.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne potvrdené rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {confirmed.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Prebieha prenájom"
        subtitle="Tieto rezervácie sú už odovzdané a nástroj je u teba."
      >
        {inRental.length === 0 ? (
          <p className="text-white/60">Momentálne nemáš žiadny aktívny prenájom.</p>
        ) : (
          <ul className="space-y-3">
            {inRental.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Čaká na potvrdenie vrátenia"
        subtitle="Označil si, že si vrátil. Čaká sa na potvrdenie prenajímateľa."
      >
        {returnPending.length === 0 ? (
          <p className="text-white/60">Žiadne rezervácie nečakajú na potvrdenie vrátenia.</p>
        ) : (
          <ul className="space-y-3">
            {returnPending.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Dokončené rezervácie"
        subtitle="Prenájmy, ktoré sú riadne ukončené."
      >
        {completed.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne dokončené rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {completed.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Sporné rezervácie"
        subtitle="Rezervácie, pri ktorých bol nahlásený problém."
      >
        {disputed.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne sporné rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {disputed.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Zrušené rezervácie"
        subtitle="História zrušených rezervácií."
      >
        {cancelled.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne zrušené rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {cancelled.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>
    </main>
  );
}
