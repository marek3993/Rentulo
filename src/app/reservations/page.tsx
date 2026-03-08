"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Reservation = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  status: "pending" | "confirmed" | "cancelled" | string;
  payment_status: "unpaid" | "paid" | "failed" | string;
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

function reservationStatusBadge(status: string) {
  if (status === "confirmed") {
    return "bg-green-600/90 text-white";
  }
  if (status === "pending") {
    return "bg-yellow-400 text-black";
  }
  if (status === "cancelled") {
    return "bg-red-600/90 text-white";
  }
  return "bg-white/10 text-white";
}

function paymentStatusBadge(status: string) {
  if (status === "paid") {
    return "bg-green-600/90 text-white";
  }
  if (status === "failed") {
    return "bg-red-600/90 text-white";
  }
  return "bg-yellow-400 text-black";
}

export default function ReservationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [status, setStatus] = useState("Načítavam...");

  const load = async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_provider")
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setRows((data ?? []) as Reservation[]);
    setStatus("");
  };

  useEffect(() => {
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) {
        router.push("/login");
        return;
      }
      await load();
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const cancel = async (id: number) => {
    setStatus("Upravujem...");

    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    await load();
  };

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const confirmed = useMemo(() => rows.filter((r) => r.status === "confirmed"), [rows]);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-white/60">{subtitle}</p>
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );

  const Card = ({ r }: { r: Reservation }) => {
    const canPay = r.status === "pending" && r.payment_status === "unpaid";
    const canCancel = r.status !== "cancelled";
    const canDispute = r.status === "confirmed";

    const startIn = daysUntil(r.date_from);
    const endIn = daysUntil(r.date_to);

    const countdownText =
      r.status === "cancelled"
        ? "Táto rezervácia je zrušená."
        : startIn > 0
        ? `Začína o ${startIn} ${startIn === 1 ? "deň" : startIn < 5 ? "dni" : "dní"}.`
        : endIn >= 0
        ? `Prenájom práve prebieha alebo začína dnes.`
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
              className={`rounded-full px-3 py-1 text-sm font-medium ${reservationStatusBadge(
                r.status
              )}`}
            >
              {r.status === "pending"
                ? "Čakajúca"
                : r.status === "confirmed"
                ? "Potvrdená"
                : r.status === "cancelled"
                ? "Zrušená"
                : r.status}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${paymentStatusBadge(
                r.payment_status
              )}`}
            >
              {r.payment_status === "unpaid"
                ? "Nezaplatené"
                : r.payment_status === "paid"
                ? "Zaplatené"
                : r.payment_status === "failed"
                ? "Zlyhalo"
                : r.payment_status}
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

          {canDispute ? (
            <Link
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              href={`/disputes/new?reservation_id=${r.id}`}
            >
              Vytvoriť reklamáciu
            </Link>
          ) : null}

          {canCancel ? (
            <button
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              onClick={() => cancel(r.id)}
              type="button"
            >
              Zrušiť rezerváciu
            </button>
          ) : null}
        </div>
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
              Prehľad všetkých rezervácií rozdelených podľa stavu.
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

      <div className="grid gap-6">
        <SectionCard
          title="Čakajúce rezervácie"
          subtitle="Rezervácie, ktoré ešte čakajú na potvrdenie alebo platbu."
        >
          {pending.length === 0 ? (
            <p className="text-white/60">Nemáte žiadne čakajúce rezervácie.</p>
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
          subtitle="Rezervácie, ktoré boli potvrdené a sú pripravené na realizáciu."
        >
          {confirmed.length === 0 ? (
            <p className="text-white/60">Nemáte žiadne potvrdené rezervácie.</p>
          ) : (
            <ul className="space-y-3">
              {confirmed.map((r) => (
                <Card key={r.id} r={r} />
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard
          title="Zrušené rezervácie"
          subtitle="História rezervácií, ktoré boli zrušené."
        >
          {cancelled.length === 0 ? (
            <p className="text-white/60">Nemáte žiadne zrušené rezervácie.</p>
          ) : (
            <ul className="space-y-3">
              {cancelled.map((r) => (
                <Card key={r.id} r={r} />
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </main>
  );
}