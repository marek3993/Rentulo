"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Row = {
  id: number;
  reservation_id: number;
  item_id: number;
  renter_id: string;
  reason: string;
  details: string | null;
  status: "open" | "in_review" | "resolved" | "rejected";
  created_at: string;
};

export default function OwnerDisputesPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Loading...");

  const load = async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("disputes")
      .select("id,reservation_id,item_id,renter_id,reason,details,status,created_at")
      .order("id", { ascending: false });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setRows((data ?? []) as any);
    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (id: number, next: Row["status"]) => {
    setStatus("Updating...");
    const { error } = await supabase.from("disputes").update({ status: next }).eq("id", id);
    if (error) {
      setStatus("Error: " + error.message);
      return;
    }
    await load();
  };

  return (
    <main className="p-8">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Owner: disputes</h1>
        <Link className="underline" href="/items">
          Items
        </Link>
      </div>

      {status ? <p className="mt-4">{status}</p> : null}

      <ul className="mt-6 space-y-3">
        {rows.map((d) => (
          <li key={d.id} className="rounded border p-4">
            <div className="flex flex-wrap gap-2">
              <strong>#{d.id}</strong>
              <span className="opacity-80">Reservation: {d.reservation_id}</span>
              <span className="opacity-80">Item: {d.item_id}</span>
              <span className="opacity-80">Renter: {d.renter_id}</span>
            </div>

            <div className="mt-2">
              Status: <strong>{d.status}</strong>
            </div>

            <div className="mt-2 opacity-80">
              <div className="font-medium">{d.reason}</div>
              {d.details ? <div className="mt-1">{d.details}</div> : null}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded border px-3 py-1 hover:bg-white/10"
                onClick={() => updateStatus(d.id, "in_review")}
                type="button"
              >
                In review
              </button>
              <button
                className="rounded border px-3 py-1 hover:bg-white/10"
                onClick={() => updateStatus(d.id, "resolved")}
                type="button"
              >
                Resolved
              </button>
              <button
                className="rounded border px-3 py-1 hover:bg-white/10"
                onClick={() => updateStatus(d.id, "rejected")}
                type="button"
              >
                Rejected
              </button>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
