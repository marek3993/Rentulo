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
  owner_id: string; // <- pridane
};

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itemId = Number(params.id);

  const [item, setItem] = useState<Item | null>(null);
  const [status, setStatus] = useState("Loading...");

  // reservations -> red/disabled ranges
  const [reservedRanges, setReservedRanges] = useState<{ from: Date; to: Date }[]>([]);
  const [range, setRange] = useState<DateRange | undefined>();

  // reviews state
  const [itemReviewAvg, setItemReviewAvg] = useState<number | null>(null);
  const [itemReviewCount, setItemReviewCount] = useState(0);

  const [ownerReviewAvg, setOwnerReviewAvg] = useState<number | null>(null);
  const [ownerReviewCount, setOwnerReviewCount] = useState(0);

  const [reviews, setReviews] = useState<
    { id: number; rating: number; comment: string | null; created_at: string }[]
  >([]);

  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState("");

  // keep string states so reserve() stays simple
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
        .select("id,title,description,price_per_day,city,owner_id")
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

      const typedItem = itemData as Item;
      setItem(typedItem);

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

      // 3) item reviews aggregate
      const { data: itemAgg } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_type", "item")
        .eq("item_id", itemId);

      if (itemAgg) {
        const ratings = itemAgg
          .map((x: any) => Number(x.rating))
          .filter((n) => Number.isFinite(n));
        setItemReviewCount(ratings.length);
        setItemReviewAvg(
          ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
        );
      }

      // 4) owner reviews aggregate
      const ownerId = typedItem.owner_id;

      const { data: ownerAgg } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_type", "owner")
        .eq("reviewee_id", ownerId);

      if (ownerAgg) {
        const ratings = ownerAgg
          .map((x: any) => Number(x.rating))
          .filter((n) => Number.isFinite(n));
        setOwnerReviewCount(ratings.length);
        setOwnerReviewAvg(
          ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
        );
      }

      // 5) list item reviews
      const { data: list } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at")
        .eq("reviewee_type", "item")
        .eq("item_id", itemId)
        .order("id", { ascending: false });

      setReviews((list ?? []) as any);

      setStatus("");
    };

    if (!Number.isFinite(itemId)) return;
    run();
  }, [itemId]);

  const submitReview = async () => {
    setStatus("Submitting review...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) {
      router.push("/login");
      return;
    }

    if (myRating < 1 || myRating > 5) {
      setStatus("Rating must be 1-5.");
      return;
    }

    if (!item) {
      setStatus("Item not loaded yet.");
      return;
    }

    // find latest confirmed reservation by this user for this item
    const { data: resv, error: resvErr } = await supabase
      .from("reservations")
      .select("id")
      .eq("item_id", itemId)
      .eq("renter_id", userId)
      .eq("status", "confirmed")
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (resvErr || !resv) {
      setStatus("You can review only after a confirmed reservation.");
      return;
    }

    const { error } = await supabase.from("reviews").insert({
      reservation_id: resv.id,
      item_id: itemId,
      reviewer_id: userId,
      rating: myRating,
      comment: myComment.trim() ? myComment.trim() : null,
      reviewee_type: "item",
      reviewee_id: item.owner_id, // owner of the item (DB policy vyzaduje)
    });

    if (error) {
      setStatus("Error: " + error.message);
      return;
    }

    setMyComment("");
    setStatus("Review submitted ✅");

    // refresh list + aggregates (minimal)
    const { data: list } = await supabase
      .from("reviews")
      .select("id,rating,comment,created_at")
      .eq("reviewee_type", "item")
      .eq("item_id", itemId)
      .order("id", { ascending: false });

    setReviews((list ?? []) as any);

    const { data: itemAgg } = await supabase
      .from("reviews")
      .select("rating")
      .eq("reviewee_type", "item")
      .eq("item_id", itemId);

    if (itemAgg) {
      const ratings = itemAgg
        .map((x: any) => Number(x.rating))
        .filter((n) => Number.isFinite(n));
      setItemReviewCount(ratings.length);
      setItemReviewAvg(
        ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
      );
    }
  };

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

          {/* REVIEWS UI */}
          <div className="mt-4 max-w-md rounded border p-4 space-y-3">
            <div className="flex flex-wrap gap-6">
              <div>
                <div className="font-semibold">Item rating</div>
                <div className="opacity-80">
                  {itemReviewAvg !== null ? itemReviewAvg.toFixed(2) : "-"} ⭐ ({itemReviewCount})
                </div>
              </div>

              <div>
                <div className="font-semibold">Owner rating</div>
                <div className="opacity-80">
                  {ownerReviewAvg !== null ? ownerReviewAvg.toFixed(2) : "-"} ⭐ ({ownerReviewCount})
                </div>
              </div>
            </div>

            <div>
              <div className="font-semibold">Reviews</div>
              {reviews.length === 0 ? (
                <div className="opacity-80 mt-2">No reviews yet.</div>
              ) : (
                <ul className="mt-2 space-y-2">
                  {reviews.map((r) => (
                    <li key={r.id} className="rounded border border-white/10 p-3">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{r.rating} ⭐</div>
                        <div className="opacity-60 text-sm">
                          {new Date(r.created_at).toISOString().slice(0, 10)}
                        </div>
                      </div>
                      {r.comment ? <div className="mt-2 opacity-90">{r.comment}</div> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="pt-1">
              <div className="font-semibold">Add review</div>

              <div className="mt-2 flex items-center gap-2">
                <label className="opacity-80">Rating</label>
                <select
                  className="rounded border border-white/20 bg-white px-2 py-1 text-black"
                  value={myRating}
                  onChange={(e) => setMyRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <textarea
                className="mt-2 w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                rows={3}
                placeholder="Comment (optional)"
                value={myComment}
                onChange={(e) => setMyComment(e.target.value)}
              />

              <button
                className="mt-2 rounded border px-3 py-1 hover:bg-white/10"
                onClick={submitReview}
                type="button"
              >
                Submit review
              </button>
            </div>
          </div>

          {/* RESERVE UI */}
          <div className="mt-6 max-w-md space-y-3 rounded border p-4">
            <h2 className="text-lg font-semibold">Reserve</h2>

            <DayPicker
              mode="range"
              selected={range}
              onSelect={(r) => setRange(r)}
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
