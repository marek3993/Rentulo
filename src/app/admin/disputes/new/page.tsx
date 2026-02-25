"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

export default function NewDisputePage() {
  const router = useRouter();
  const sp = useSearchParams();
  const reservationId = Number(sp.get("reservation_id"));

  const [status, setStatus] = useState("Loading...");
  const [reason, setReason] = useState("Damaged item");
  const [details, setDetails] = useState("");

  const [itemId, setItemId] = useState<number | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        router.push("/login");
        return;
      }
      if (!Number.isFinite(reservationId)) {
        setStatus("Missing reservation_id");
        return;
      }

      // load reservation -> item_id
      const { data: resv, error: rErr } = await supabase
        .from("reservations")
        .select("id,item_id,status,renter_id")
        .eq("id", reservationId)
        .maybeSingle();

      if (rErr || !resv) {
        setStatus("Reservation not found.");
        return;
      }
      if (resv.status !== "confirmed") {
        setStatus("You can create a dispute only for confirmed reservations.");
        return;
      }

      const userId = sess.session.user.id;
      if (resv.renter_id !== userId) {
        setStatus("Not allowed.");
        return;
      }

      setItemId(resv.item_id);

      // load item -> owner_id
      const { data: item, error: iErr } = await supabase
        .from("items")
        .select("id,owner_id,title")
        .eq("id", resv.item_id)
        .maybeSingle();

      if (iErr || !item) {
        setStatus("Item not found.");
        return;
      }

      setOwnerId(item.owner_id);
      setStatus("");
    };

    run();
  }, [reservationId, router]);

  const submit = async () => {
    setStatus("Creating dispute...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) {
      router.push("/login");
      return;
    }

    if (!itemId || !ownerId) {
      setStatus("Missing item/owner.");
      return;
    }

    if (!reason.trim()) {
      setStatus("Reason is required.");
      return;
    }

    const { error } = await supabase.from("disputes").insert({
      reservation_id: reservationId,
      item_id: itemId,
      renter_id: userId,
      owner_id: ownerId,
      reason: reason.trim(),
      details: details.trim() ? details.trim() : null,
      status: "open",
    });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    router.push("/reservations");
  };

  return (
    <main className="p-8 max-w-xl">
      <Link className="underline" href="/reservations">
        ← Back to my reservations
      </Link>

      <h1 className="mt-4 text-2xl font-semibold">Create dispute</h1>
      {status ? <p className="mt-4">{status}</p> : null}

      {!status ? (
        <div className="mt-6 space-y-3 rounded border p-4">
          <label className="block">
            <div className="mb-1 opacity-80">Reason</div>
            <select
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            >
              <option>Damaged item</option>
              <option>Item not as described</option>
              <option>Late / no show</option>
              <option>Other</option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 opacity-80">Details</div>
            <textarea
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              rows={5}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Describe what happened..."
            />
          </label>

          <button
            className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
            onClick={submit}
            type="button"
          >
            Submit dispute
          </button>
        </div>
      ) : null}
    </main>
  );
}
