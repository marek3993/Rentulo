"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import { supabase } from "@/lib/supabaseClient";

type Item = {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
  owner_id: string;
};

type OwnerProfile = {
  id: string;
  full_name: string | null;
  city: string | null;
  avatar_path: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
};

type ReviewRow = { id: number; rating: number; comment: string | null; created_at: string };

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const itemId = Number(params.id);

  const [status, setStatus] = useState("Načítavam...");

  const [item, setItem] = useState<Item | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);

  const [imageUrls, setImageUrls] = useState<string[]>([]);

  // kalendár
  const [reservedRanges, setReservedRanges] = useState<{ from: Date; to: Date }[]>([]);
  const [range, setRange] = useState<DateRange | undefined>();

  // hodnotenia
  const [itemReviewAvg, setItemReviewAvg] = useState<number | null>(null);
  const [itemReviewCount, setItemReviewCount] = useState(0);

  const [ownerReviewAvg, setOwnerReviewAvg] = useState<number | null>(null);
  const [ownerReviewCount, setOwnerReviewCount] = useState(0);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState("");

  // dátumy (pre insert do DB)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const selectedFrom = range?.from ? range.from.toISOString().slice(0, 10) : "";
  const selectedTo = range?.to ? range.to.toISOString().slice(0, 10) : "";

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
      setStatus("Načítavam...");

      // 1) item
      const { data: itemData, error: itemErr } = await supabase
        .from("items")
        .select("id,title,description,price_per_day,city,owner_id")
        .eq("id", itemId)
        .maybeSingle();

      if (itemErr) {
        setStatus("Chyba: " + itemErr.message);
        return;
      }
      if (!itemData) {
        setStatus("Nenájdené");
        return;
      }

      const typedItem = itemData as Item;
      setItem(typedItem);

      // 2) fotky itemu
      const { data: imgs, error: imgErr } = await supabase
        .from("item_images")
        .select("path")
        .eq("item_id", itemId)
        .order("id", { ascending: true });

      if (!imgErr && imgs) {
        const urls = (imgs as any[]).map(
          (x) => supabase.storage.from("item-images").getPublicUrl(x.path).data.publicUrl
        );
        setImageUrls(urls);
      } else {
        setImageUrls([]);
      }

      // 3) prenajímateľ profil
      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select("id,full_name,city,avatar_path,instagram_url,facebook_url,linkedin_url,website_url")
        .eq("id", typedItem.owner_id)
        .maybeSingle();

      if (!profErr && prof) {
        setOwner(prof as any);
      } else {
        setOwner(null);
      }

      // 4) rezervácie pre kalendár (pending len “fresh” 15 min + confirmed)
      const { data: reservations, error: rErr } = await supabase
        .from("reservations")
        .select("date_from,date_to,status,created_at")
        .eq("item_id", itemId);

      if (!rErr && reservations) {
        const now = Date.now();
        const ttlMs = 15 * 60 * 1000;

        const ranges = (reservations as any[])
          .filter((r) => {
            if (r.status === "confirmed") return true;
            if (r.status !== "pending") return false;
            const created = new Date(r.created_at).getTime();
            return Number.isFinite(created) && now - created <= ttlMs;
          })
          .map((r) => ({ from: new Date(r.date_from), to: new Date(r.date_to) }));

        setReservedRanges(ranges);
      } else {
        setReservedRanges([]);
      }

      // 5) item rating aggregate
      const { data: itemAgg } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_type", "item")
        .eq("item_id", itemId);

      if (itemAgg) {
        const ratings = itemAgg.map((x: any) => Number(x.rating)).filter((n) => Number.isFinite(n));
        setItemReviewCount(ratings.length);
        setItemReviewAvg(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null);
      }

      // 6) owner rating aggregate
      const { data: ownerAgg } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_type", "owner")
        .eq("reviewee_id", typedItem.owner_id);

      if (ownerAgg) {
        const ratings = ownerAgg.map((x: any) => Number(x.rating)).filter((n) => Number.isFinite(n));
        setOwnerReviewCount(ratings.length);
        setOwnerReviewAvg(ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null);
      }

      // 7) list reviews (item)
      const { data: list } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at")
        .eq("reviewee_type", "item")
        .eq("item_id", itemId)
        .order("id", { ascending: false });

      setReviews(((list ?? []) as any) as ReviewRow[]);

      setStatus("");
    };

    if (!Number.isFinite(itemId)) return;
    run();
  }, [itemId]);

  const ownerAvatarUrl = useMemo(() => {
    if (!owner?.avatar_path) return null;
    return supabase.storage.from("avatars").getPublicUrl(owner.avatar_path).data.publicUrl;
  }, [owner?.avatar_path]);

  const estimatedTotal = useMemo(() => {
    if (!item || days <= 0) return null;
    return (days * item.price_per_day).toFixed(2);
  }, [days, item]);

  const reserve = async () => {
    setStatus("Vytváram rezerváciu...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    if (!dateFrom || !dateTo) {
      setStatus("Vyberte dátum od/do.");
      return;
    }

    if (days <= 0) {
      setStatus("Neplatný rozsah dátumov.");
      return;
    }

    // ensure profile exists
    const { data: prof, error: profErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (profErr) {
      setStatus("Chyba: " + profErr.message);
      return;
    }

    if (!prof) {
      const { error: insProfErr } = await supabase.from("profiles").insert({ id: userId, role: "user" });
      if (insProfErr) {
        setStatus("Chyba: " + insProfErr.message);
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
        ? "Táto položka je už rezervovaná v zadanom termíne."
        : error.message;
      setStatus("Chyba: " + msg);
      return;
    }

    router.push(`/payment?reservation_id=${reservation.id}`);
  };

  const submitReview = async () => {
    setStatus("Odosielam hodnotenie...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) {
      router.push("/login");
      return;
    }

    if (!item) {
      setStatus("Položka nie je načítaná.");
      return;
    }

    if (myRating < 1 || myRating > 5) {
      setStatus("Hodnotenie musí byť 1–5.");
      return;
    }

    // latest confirmed reservation by this user for this item
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
      setStatus("Hodnotiť môžete až po potvrdenej rezervácii.");
      return;
    }

    const { error } = await supabase.from("reviews").insert({
      reservation_id: resv.id,
      item_id: itemId,
      reviewer_id: userId,
      rating: myRating,
      comment: myComment.trim() ? myComment.trim() : null,
      reviewee_type: "item",
      reviewee_id: item.owner_id,
    });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setMyComment("");
    setStatus("Hodnotenie pridané ✅");

    // refresh list quickly
    const { data: list } = await supabase
      .from("reviews")
      .select("id,rating,comment,created_at")
      .eq("reviewee_type", "item")
      .eq("item_id", itemId)
      .order("id", { ascending: false });

    setReviews(((list ?? []) as any) as ReviewRow[]);
  };

  if (status === "Nenájdené") {
    return (
      <main>
        <Link className="underline" href="/items">
          ← Späť na ponuky
        </Link>
        <p className="mt-4">Položka neexistuje.</p>
      </main>
    );
  }

  return (
    <main>
      <Link className="underline" href="/items">
        ← Späť na ponuky
      </Link>

      {status ? <p className="mt-4">{status}</p> : null}

      {item ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          {/* Ľavý stĺpec: fotky + info */}
          <div className="lg:col-span-2 space-y-4">
            {/* Galéria */}
            {imageUrls.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {imageUrls.map((u) => (
                  <img
                    key={u}
                    src={u}
                    alt="fotka"
                    className="h-40 w-full rounded-xl border border-white/10 object-cover"
                  />
                ))}
              </div>
            ) : (
              <div className="h-56 w-full rounded-xl border border-white/10 bg-white/5" />
            )}

            {/* Nadpis + meta */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <h1 className="text-2xl font-semibold">{item.title}</h1>
              <div className="mt-2 text-white/80">
                <strong>{item.price_per_day} €</strong> <span className="text-white/60">/ deň</span>
                {item.city ? <span className="text-white/60"> · {item.city}</span> : null}
              </div>

              {item.description ? (
                <p className="mt-4 text-white/80 whitespace-pre-wrap">{item.description}</p>
              ) : (
                <p className="mt-4 text-white/60">Bez popisu.</p>
              )}
            </div>

            {/* Hodnotenia */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <div className="font-semibold">Hodnotenie položky</div>
                  <div className="text-white/80">
                    {itemReviewAvg !== null ? itemReviewAvg.toFixed(2) : "-"} ⭐ ({itemReviewCount})
                  </div>
                </div>
                <div>
                  <div className="font-semibold">Hodnotenie prenajímateľa</div>
                  <div className="text-white/80">
                    {ownerReviewAvg !== null ? ownerReviewAvg.toFixed(2) : "-"} ⭐ ({ownerReviewCount})
                  </div>
                </div>
              </div>

              <div>
                <div className="font-semibold">Recenzie</div>
                {reviews.length === 0 ? (
                  <div className="mt-2 text-white/60">Zatiaľ bez recenzií.</div>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {reviews.map((r) => (
                      <li key={r.id} className="rounded-xl border border-white/10 p-4">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{r.rating} ⭐</div>
                          <div className="text-white/60 text-sm">
                            {new Date(r.created_at).toISOString().slice(0, 10)}
                          </div>
                        </div>
                        {r.comment ? <div className="mt-2 text-white/80">{r.comment}</div> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-xl border border-white/10 p-4">
                <div className="font-semibold">Pridať hodnotenie</div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-white/70">Hodnotenie:</span>
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
                  className="mt-3 w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  rows={3}
                  placeholder="Komentár (voliteľné)"
                  value={myComment}
                  onChange={(e) => setMyComment(e.target.value)}
                />

                <button
                  className="mt-3 rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                  onClick={submitReview}
                  type="button"
                >
                  Odoslať hodnotenie
                </button>

                <div className="mt-2 text-sm text-white/60">
                  Hodnotenie je povolené až po potvrdenej rezervácii.
                </div>
              </div>
            </div>
          </div>

          {/* Pravý stĺpec: prenajímateľ + rezervácia */}
          <div className="space-y-4">
            {/* Prenajímateľ karta */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="font-semibold">Prenajímateľ</div>

              <div className="mt-4 flex items-center gap-3">
                {ownerAvatarUrl ? (
                  <img
                    src={ownerAvatarUrl}
                    alt="avatar"
                    className="h-12 w-12 rounded-full border border-white/10 object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-full border border-white/10 bg-white/5" />
                )}

                <div>
                  <div className="font-medium">{owner?.full_name ?? "Bez mena"}</div>
                  <div className="text-white/60 text-sm">{owner?.city ?? "Bez mesta"}</div>
                </div>
              </div>

              {(owner?.website_url ||
                owner?.instagram_url ||
                owner?.facebook_url ||
                owner?.linkedin_url) ? (
                <div className="mt-4 space-y-2 text-sm">
                  {owner.website_url ? (
                    <a className="underline text-white/80" href={owner.website_url} target="_blank" rel="noreferrer">
                      Web
                    </a>
                  ) : null}
                  {owner.instagram_url ? (
                    <a className="underline text-white/80 block" href={owner.instagram_url} target="_blank" rel="noreferrer">
                      Instagram
                    </a>
                  ) : null}
                  {owner.facebook_url ? (
                    <a className="underline text-white/80 block" href={owner.facebook_url} target="_blank" rel="noreferrer">
                      Facebook
                    </a>
                  ) : null}
                  {owner.linkedin_url ? (
                    <a className="underline text-white/80 block" href={owner.linkedin_url} target="_blank" rel="noreferrer">
                      LinkedIn
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="mt-4 text-sm text-white/60">Bez sociálnych sietí.</div>
              )}
            </div>

            {/* Rezervácia karta */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 space-y-3">
              <div className="font-semibold">Rezervácia</div>

              <DayPicker
                mode="range"
                selected={range}
                onSelect={(r) => {
                  setRange(r);
                  const from = r?.from ? r.from.toISOString().slice(0, 10) : "";
                  const to = r?.to ? r.to.toISOString().slice(0, 10) : "";
                  setDateFrom(from);
                  setDateTo(to);
                }}
                disabled={[...reservedRanges, { before: new Date() }]}
                modifiers={{ reserved: reservedRanges }}
                modifiersStyles={{
                  reserved: { backgroundColor: "#7f1d1d", color: "white" },
                  selected: { backgroundColor: "#ffffff", color: "black" },
                }}
              />

              <div className="text-white/80">
                <div>
                  Vybrané:{" "}
                  <strong>
                    {selectedFrom || "-"} → {selectedTo || "-"}
                  </strong>
                </div>
                <div className="mt-1 text-white/70">
                  Dní: <strong>{days || "-"}</strong>
                  {estimatedTotal ? (
                    <>
                      {" "}
                      · Odhad: <strong>{estimatedTotal} €</strong>
                    </>
                  ) : null}
                </div>
              </div>

              <button
                className="w-full rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                onClick={reserve}
                disabled={!range?.from || !range?.to}
                type="button"
              >
                Rezervovať (platba neskôr)
              </button>

              <div className="text-sm text-white/60">
                Rezervované dni sú červené a nedajú sa vybrať.
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}