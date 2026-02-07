"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

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

  useEffect(() => {
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) {
        router.push("/login");
        return;
      }

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

    run();
  }, [router]);

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">My reservations</h1>
      {status ? <p className="mt-4">{status}</p> : null}

      <ul className="mt-6 space-y-3">
        {items.map((r) => (
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
          </li>
        ))}
      </ul>
    </main>
  );
}
