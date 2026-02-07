"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Row = {
  id: number;
  item_id: number;
  renter_id: string;
  date_from: string;
  date_to: string;
  status: string;
  payment_status: string;
  payment_provider: string;
};

export default function AdminReservationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Loading...");

  const load = async () => {
    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,renter_id,date_from,date_to,status,payment_status,payment_provider")
      .order("id", { ascending: false });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setRows((data ?? []) as Row[]);
    setStatus("");
  };

  useEffect(() => {
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        router.push("/login");
        return;
      }

      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", sess.session.user.id)
        .maybeSingle();

      if (prof?.role !== "admin") {
        router.push("/");
        return;
      }

      await load();
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const updateReservation = async (id: number, patch: Partial<Row>) => {
    setStatus("Updating...");
    const { error } = await supabase.from("reservations").update(patch).eq("id", id);

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    await load();
  };

  return (
    <main className="p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin: Reservations</h1>
        <div className="flex gap-3">
          <Link className="underline" href="/admin/items">Admin items</Link>
          <Link className="underline" href="/">Home</Link>
        </div>
      </div>

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
                onClick={() => updateReservation(r.id, { status: "confirmed" })}
                disabled={r.status === "confirmed"}
                type="button"
              >
                Confirm
              </button>

              <button
                className="rounded border px-3 py-1 hover:bg-white/10 disabled:opacity-50"
                onClick={() => updateReservation(r.id, { status: "cancelled" })}
                disabled={r.status === "cancelled"}
                type="button"
              >
                Cancel
              </button>

              <button
                className="rounded border px-3 py-1 hover:bg-white/10 disabled:opacity-50"
                onClick={() => updateReservation(r.id, { payment_status: "paid", payment_provider: "manual" as any })}
                disabled={r.payment_status === "paid"}
                type="button"
              >
                Mark paid (manual)
              </button>

              <button
                className="rounded border px-3 py-1 hover:bg-white/10 disabled:opacity-50"
                onClick={() => updateReservation(r.id, { payment_status: "unpaid", payment_provider: "none" })}
                disabled={r.payment_status === "unpaid"}
                type="button"
              >
                Mark unpaid
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
