"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { DayPicker, type DateRange } from "react-day-picker";

type Item = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
};

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itemId = Number(params.id);

  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState("Loading...");

  const [reservedRanges, setReservedRanges] = useState<{ from: Date; to: Date }[]>([]);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const days = useMemo(() => {
    if (!dateFrom || !dateTo) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    const d1 = new Date(dateFrom).getTime();
    const d2 = new Date(dateTo).getTime();
    if (Number.isNaN(d1) || Number.isNaN(d2)) return 0;
    const diff = Math.floor((d2 - d1) / msPerDay) + 1;
    return Math.max(diff, 0);
  }, [dateFrom, dateTo]);

  useEffect(() => {
    const run = async () => {
      try {
        await fetch("/api/maintenance/expire-pending", { method: "POST" });
      } catch {}

      setStatus("Loading...");

      // 1) load item
      const { data: itemData, error: itemErr } = await supabase
        .from("items")
        .select("id,title,description,price_per_day,city")
        .eq("id", itemId)
        .maybeSingle();

      if (itemErr) {
        setStatus("Error: " + itemErr.message);
        return;
      }
      if (!itemData) {
        setStatus("Not found");
        return;
      }
      setItem(itemData as Item);

      // 2) load reservations for calendar (include created_at)
      const { data: reservations, error: rErr } = await supabase
        .from("reservations")
        .select("date_from,date_to,status,created_at")
        .eq("item_id", itemId);

      if (!rErr && reservations) {
        const now = Date.now();
        const ttlMs = 15 * 60 * 1000; // 15 min

        const ranges = (reservations as any[])
          .filter((r) => {
            if (r.status === "confirmed") return true;
            if (r.status !== "pending") return false;

            const created = new Date(r.created_at).getTime();
            return Number.isFinite(created) && now - created <= ttlMs;
          })
          .map((r) => ({
            from: new Date(r.date_from),
            to: new Date(r.date_to),
          }));

        setReservedRanges(ranges);
      }

      setStatus("");
    };

    if (!Number.isFinite(itemId)) return;
    run();
  }, [itemId]);

  const reserve = async () => {
    setStatus("Creating reservation...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    if (!dateFrom || !dateTo) {
      setStatus("Please select date_from and date_to.");
      return;
    }

    if (days <= 0) {
      setStatus("Invalid date range.");
      return;
    }

    // ensure profile exists (robust)
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      setStatus("Error: " + profErr.message);
      return;
    }

    if (!prof) {
      const { error: insProfErr } = await supabase
        .from("profiles")
        .insert({ id: userId, role: "user" });

      if (insProfErr) {
        setStatus("Error: " + insProfErr.message);
        return;
      }
    }

    const { data: reservation, error } = await supabase
      .from("reservations")
      .insert({
        item_id: itemId,
        renter_id: userId,
        date_from: dateFrom,
        date_to: dateTo,
        status: "pending",
        payment_provider: "none",
        payment_status: "unpaid",
      })
      .select("id")
      .single();

    if (error) {
      const msg = error.message.includes("overlaps")
        ? "This item is already reserved in that date range."
        : error.message;

      setStatus("Error: " + msg);
      return;
    }

    router.push(`/payment?reservation_id=${reservation.id}`);
  };

  const selectedFrom = range?.from ? range.from.toISOString().slice(0, 10) : "-";
  const selectedTo = range?.to ? range.to.toISOString().slice(0, 10) : "-";

  return (
    <main className="p-8">
      <Link className="underline" href="/items">
        ← Back to items
      </Link>

      {status ? <p className="mt-4">{status}</p> : null}

      {item ? (
        <div className="mt-6 space-y-3">
          <h1 className="text-2xl font-semibold">{item.title}</h1>

          <div className="opacity-80">
            {item.city ? item.city + " · " : ""}
            {item.price_per_day} €/day
          </div>

          {item.description ? <p className="mt-2">{item.description}</p> : null}

          <div className="mt-6 max-w-md space-y-3 rounded border p-4">
            <h2 className="text-lg font-semibold">Reserve</h2>

            <DayPicker
              mode="range"
              selected={range}
              onSelect={setRange}
              disabled={[...reservedRanges, { before: new Date() }]}
              modifiers={{ reserved: reservedRanges }}
              modifiersStyles={{
                reserved: { backgroundColor: "#7f1d1d", color: "white" },
              }}
            />

            <div className="opacity-80">
              Selected: {selectedFrom} → {selectedTo}
            </div>

            <div className="opacity-80">
              Days: {days || "-"} · Estimated total:{" "}
              {days > 0 ? `${(days * item.price_per_day).toFixed(2)} €` : "-"}
            </div>

            <button
              className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
              onClick={() => {
                const from = range?.from ? range.from.toISOString().slice(0, 10) : "";
                const to = range?.to ? range.to.toISOString().slice(0, 10) : "";
                setDateFrom(from);
                setDateTo(to);
                reserve();
              }}
              disabled={!range?.from || !range?.to}
              type="button"
            >
              Reserve (pay later)
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
