"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Reservation = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  status: string;
  payment_status: string;
  payment_provider: string;
};

export default function ReservationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Reservation[]>([]);
  const [status, setStatus] = useState("Loading...");

  const load = async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_provider")
      .order("id", { ascending: false });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setItems((data ?? []) as Reservation[]);
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
    setStatus("Updating...");
    const { error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    await load();
  };

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My reservations</h1>
        <Link className="underline" href="/items">Items</Link>
      </div>

      {status ? <p className="mt-4">{status}</p> : null}

      <ul className="mt-6 space-y-3">
        {items.map((r) => {
          const canPay = r.status === "pending" && r.payment_status === "unpaid";
          const canCancel = r.status !== "cancelled";

          return (
            <li key={r.id} className="rounded border p-4">
              <div className="flex flex-wrap gap-2">
                <strong>#{r.id}</strong>
                <span className="opacity-80">Item: {r.item_id}</span>
              </div>

              <div className="mt-2 opacity-80">
                {r.date_from} → {r.date_to}
              </div>

              <div className="mt-2">
                Status: <strong>{r.status}</strong> · Payment:{" "}
                <strong>{r.payment_status}</strong> ({r.payment_provider})
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {canPay ? (
                  <Link
                    className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                    href={`/payment?reservation_id=${r.id}`}
                  >
                    Pay
                  </Link>
                ) : null}

                {canCancel ? (
                  <button
                    className="rounded border px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                    onClick={() => cancel(r.id)}
                    type="button"
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
