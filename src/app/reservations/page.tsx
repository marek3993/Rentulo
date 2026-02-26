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
  payment_status: string;
  payment_provider: string;
};

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
    const { error } = await supabase.from("reservations").update({ status: "cancelled" }).eq("id", id);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    await load();
  };

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const confirmed = useMemo(() => rows.filter((r) => r.status === "confirmed"), [rows]);
  const cancelled = useMemo(() => rows.filter((r) => r.status === "cancelled"), [rows]);

  const Card = ({ r }: { r: Reservation }) => {
    const canPay = r.status === "pending" && r.payment_status === "unpaid";
    const canCancel = r.status !== "cancelled";
    const canDispute = r.status === "confirmed";

    return (
      <li className="rounded border border-white/10 bg-white/5 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <strong>#{r.id}</strong>
            <span className="text-white/70">Položka: {r.item_id}</span>
          </div>
          <div className="text-white/70 text-sm">
            {r.date_from} → {r.date_to}
          </div>
        </div>

        <div className="mt-2 text-white/80">
          Stav: <strong>{r.status}</strong> · Platba: <strong>{r.payment_status}</strong> ({r.payment_provider})
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {canPay ? (
            <Link
              className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
              href={`/payment?reservation_id=${r.id}`}
            >
              Zaplatiť
            </Link>
          ) : null}

          {canDispute ? (
            <Link
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              href={`/disputes/new?reservation_id=${r.id}`}
            >
              Reklamácia
            </Link>
          ) : null}

          {canCancel ? (
            <button
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              onClick={() => cancel(r.id)}
              type="button"
            >
              Zrušiť
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  return (
    <main>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Moje rezervácie</h1>
        <Link className="rounded border border-white/15 px-3 py-1 hover:bg-white/10" href="/items">
          Ponuky
        </Link>
      </div>

      {status ? <p className="mt-4">{status}</p> : null}

      <div className="mt-6 grid gap-6">
        <section>
          <h2 className="text-lg font-semibold">Čakajúce</h2>
          {pending.length === 0 ? (
            <p className="mt-2 text-white/70">Žiadne čakajúce rezervácie.</p>
          ) : (
            <ul className="mt-3 space-y-3">{pending.map((r) => <Card key={r.id} r={r} />)}</ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold">Potvrdené</h2>
          {confirmed.length === 0 ? (
            <p className="mt-2 text-white/70">Žiadne potvrdené rezervácie.</p>
          ) : (
            <ul className="mt-3 space-y-3">{confirmed.map((r) => <Card key={r.id} r={r} />)}</ul>
          )}
        </section>

        <section>
          <h2 className="text-lg font-semibold">Zrušené</h2>
          {cancelled.length === 0 ? (
            <p className="mt-2 text-white/70">Žiadne zrušené rezervácie.</p>
          ) : (
            <ul className="mt-3 space-y-3">{cancelled.map((r) => <Card key={r.id} r={r} />)}</ul>
          )}
        </section>
      </div>
    </main>
  );
}