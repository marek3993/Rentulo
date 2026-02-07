"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type Row = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  status: string;
  payment_status: string;
  payment_provider: string;
  renter_id: string;
};

export default function OwnerReservationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Loading...");

  const load = async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_provider,renter_id")
      .order("id", { ascending: false });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setRows((data ?? []) as Row[]);
    setStatus("");
  };

  const updateStatus = async (id: number, nextStatus: "confirmed" | "cancelled") => {
    setStatus("Updating...");

    const { error } = await supabase
      .from("reservations")
      .update({ status: nextStatus })
      .eq("id", id);

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    await load();
  };

  useEffect(() => {
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        router.push("/login");
        return;
      }
      await load();
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Owner: reservations on my items</h1>
      {status ? <p className="mt-4">{status}</p> : null}

      <ul className="mt-6 space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="rounded border p-4">
            <div className="flex flex-wrap gap-2">
              <strong>#{r.id}</strong>
              <span className="opacity-80">Item: {r.item_id}</span>
              <span className="opacity-80">Renter: {r.renter_id}</span>
            </div>

            <div className="mt-2 opacity-80">
              {r.date_from} → {r.date_to}
            </div>

            <div className="mt-2">
              Status: <strong>{r.status}</strong> · Payment:{" "}
              <strong>{r.payment_status}</strong> ({r.payment_provider})
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded border px-3 py-1 hover:bg-white/10 disabled:opacity-50"
                onClick={() => updateStatus(r.id, "confirmed")}
                disabled={r.status === "confirmed"}
                type="button"
              >
                Confirm
              </button>

              <button
                className="rounded border px-3 py-1 hover:bg-white/10 disabled:opacity-50"
                onClick={() => updateStatus(r.id, "cancelled")}
                disabled={r.status === "cancelled"}
                type="button"
              >
                Cancel
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
