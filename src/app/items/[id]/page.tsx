"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import {
  buildItemsHref,
  buildItemSearchQueryString,
  parseItemSearchParams,
} from "@/lib/itemSearchParams";
import {
  describeItemDeliveryOptions,
  itemDeliveryOptionsNormalizedFromFields,
  type ItemDeliveryConfigFields,
} from "@/lib/itemDeliveryOptionsContract";
import ItemPreviewImage from "@/components/items/ItemPreviewImage";
import { supabase } from "@/lib/supabaseClient";

type Item = ItemDeliveryConfigFields & {
  id: number;
  title: string;
  description: string | null;
  price_per_day: number;
  city: string | null;
  owner_id: string;
  is_active: boolean;
};

type OwnerProfile = {
  id: string;
  full_name: string | null;
  city: string | null;
  bio: string | null;
  avatar_path: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  verification_status: "unverified" | "pending" | "verified" | "rejected" | string;
};

type ReviewRow = {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewee_type: string;
};

type ItemImageDetails = {
  path: string;
  is_primary: boolean | null;
  position: number | null;
  id: number;
};

type UnavailableRangeDetails = {
  date_from: string;
  date_to: string;
};

type CreateReservationResponse = {
  reservation?: {
    id: number;
  };
  error?: string;
};

type RatingRow = {
  rating: number | string | null;
};

function verificationBadgeClass(status: string) {
  if (status === "verified") return "bg-emerald-600/90 text-white";
  if (status === "pending") return "bg-yellow-400 text-black";
  if (status === "rejected") return "bg-red-600/90 text-white";
  return "bg-white/10 text-white";
}

function verificationLabel(status: string) {
  if (status === "verified") return "Overený profil";
  if (status === "pending") return "Čaká na overenie";
  if (status === "rejected") return "Overenie zamietnuté";
  return "Neoverený profil";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function parseDateOnly(value: string) {
  if (!value) return undefined;

  const [year, month, day] = value.split("-").map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return undefined;
  }

  const parsed = new Date(year, month - 1, day);

  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return undefined;
  }

  return parsed;
}

function formatDateOnly(date: Date | undefined) {
  if (!date) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function rangesEqual(a: DateRange | undefined, b: DateRange | undefined) {
  return (
    formatDateOnly(a?.from) === formatDateOnly(b?.from) &&
    formatDateOnly(a?.to) === formatDateOnly(b?.to)
  );
}

function buildInitialRange(dateFrom: string, dateTo: string): DateRange | undefined {
  if (!dateFrom || !dateTo) return undefined;

  const from = parseDateOnly(dateFrom);
  const to = parseDateOnly(dateTo);

  if (!from || !to) return undefined;

  return { from, to };
}

async function buildItemRequestHeaders() {
  const headers = new Headers();
  const sessionResult = await supabase.auth.getSession();
  const accessToken = sessionResult.data.session?.access_token;

  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }

  return headers;
}

async function fetchItemForViewer(itemId: number) {
  const response = await fetch(`/api/items/${itemId}`, {
    headers: await buildItemRequestHeaders(),
  });

  const json = (await response.json().catch(() => null)) as
    | { item?: Item; error?: string }
    | null;

  if (!response.ok) {
    return {
      item: null,
      error: json?.error || `Item request failed with status ${response.status}.`,
    };
  }

  return {
    item: json?.item ?? null,
    error: null,
  };
}

export default function ItemDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const itemId = Number(params.id);
  const itemSearchState = useMemo(() => parseItemSearchParams(searchParams), [searchParams]);

  const [status, setStatus] = useState("Načítavam...");
  const [contactingOwner, setContactingOwner] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  const [item, setItem] = useState<Item | null>(null);
  const [owner, setOwner] = useState<OwnerProfile | null>(null);

  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const [reservedRanges, setReservedRanges] = useState<{ from: Date; to: Date }[]>([]);
  const [range, setRange] = useState<DateRange | undefined>(() =>
    buildInitialRange(itemSearchState.dateFrom, itemSearchState.dateTo)
  );

  const [itemReviewAvg, setItemReviewAvg] = useState<number | null>(null);
  const [itemReviewCount, setItemReviewCount] = useState(0);

  const [ownerReviewAvg, setOwnerReviewAvg] = useState<number | null>(null);
  const [ownerReviewCount, setOwnerReviewCount] = useState(0);

  const [reviews, setReviews] = useState<ReviewRow[]>([]);

  const selectedFrom = formatDateOnly(range?.from);
  const selectedTo = formatDateOnly(range?.to);
  const hasCompleteRange = Boolean(range?.from && range?.to);
  const hasPartialRange = Boolean(range?.from && !range?.to);
  const dateFrom = hasCompleteRange ? selectedFrom : "";
  const dateTo = hasCompleteRange ? selectedTo : "";
  const syncedDateFrom = hasPartialRange ? itemSearchState.dateFrom : dateFrom;
  const syncedDateTo = hasPartialRange ? itemSearchState.dateTo : dateTo;
  const activeImage = imageUrls[activeImageIndex] ?? null;
  const deliveryOptions = useMemo(
    () =>
      item
        ? itemDeliveryOptionsNormalizedFromFields({
            delivery_mode: item.delivery_mode,
            delivery_rate_per_km: item.delivery_rate_per_km,
            delivery_fee_cap: item.delivery_fee_cap,
            delivery_max_radius_km: item.delivery_max_radius_km,
          })
        : null,
    [item]
  );
  const deliveryDescription = useMemo(
    () => (deliveryOptions ? describeItemDeliveryOptions(deliveryOptions) : null),
    [deliveryOptions]
  );
  const returnToItemsHref = useMemo(
    () =>
      buildItemsHref({
        ...itemSearchState,
        dateFrom: syncedDateFrom,
        dateTo: syncedDateTo,
      }),
    [itemSearchState, syncedDateFrom, syncedDateTo]
  );

  const days = useMemo(() => {
    if (!range?.from || !range?.to) return 0;
    const msPerDay = 24 * 60 * 60 * 1000;
    const d1 = Date.UTC(range.from.getFullYear(), range.from.getMonth(), range.from.getDate());
    const d2 = Date.UTC(range.to.getFullYear(), range.to.getMonth(), range.to.getDate());
    const diff = Math.floor((d2 - d1) / msPerDay) + 1;
    return Math.max(diff, 0);
  }, [range]);

  const estimatedTotal = useMemo(() => {
    if (!item || days <= 0) return null;
    return (days * item.price_per_day).toFixed(2);
  }, [days, item]);

  const ownerAvatarUrl = useMemo(() => {
    if (!owner?.avatar_path) return null;
    return supabase.storage.from("avatars").getPublicUrl(owner.avatar_path).data.publicUrl;
  }, [owner?.avatar_path]);
  const isOwnerViewingOwnItem = Boolean(item && currentUserId && item.owner_id === currentUserId);

  useEffect(() => {
    const nextRange = buildInitialRange(itemSearchState.dateFrom, itemSearchState.dateTo);

    setRange((currentRange) => (rangesEqual(nextRange, currentRange) ? currentRange : nextRange));
  }, [itemSearchState.dateFrom, itemSearchState.dateTo]);

  useEffect(() => {
    const nextQuery = buildItemSearchQueryString({
      ...itemSearchState,
      dateFrom: syncedDateFrom,
      dateTo: syncedDateTo,
    });
    const currentQuery = searchParams.toString();

    if (nextQuery === currentQuery) {
      return;
    }

    router.replace(nextQuery ? `/items/${itemId}?${nextQuery}` : `/items/${itemId}`, {
      scroll: false,
    });
  }, [syncedDateFrom, syncedDateTo, itemId, itemSearchState, router, searchParams]);

  useEffect(() => {
    const run = async () => {
      setStatus("Načítavam...");

      const { data: sess } = await supabase.auth.getSession();
      const sessionUserId = sess.session?.user.id ?? null;
      setCurrentUserId(sessionUserId);

      let viewerRole: string | null = null;

      if (sessionUserId) {
        const { data: viewerProfile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", sessionUserId)
          .maybeSingle();

        viewerRole = viewerProfile?.role ?? null;
        setCurrentUserRole(viewerRole);
      } else {
        setCurrentUserRole(null);
      }

      const { item: itemData, error: itemErr } = await fetchItemForViewer(itemId);

      if (itemErr) {
        if (itemErr === "Item not found.") {
          setStatus("NenĂˇjdenĂ©");
          return;
        }

        setStatus("Chyba: " + itemErr);
        return;
      }

      if (!itemData) {
        setStatus("Nenájdené");
        return;
      }

      const typedItem = itemData as Item;
      const canSeeInactive = true; // Access is enforced by /api/items/[id].

      if (!typedItem.is_active && !canSeeInactive) {
        setStatus("NenĂˇjdenĂ©");
        return;
      }

      setItem(typedItem);

      const { data: imgs, error: imgErr } = await supabase
  .from("item_images")
  .select("path,is_primary,position,id")
  .eq("item_id", itemId)
  .order("is_primary", { ascending: false })
  .order("position", { ascending: true })
  .order("id", { ascending: true });

if (!imgErr && imgs) {
  const sorted = [...(imgs as ItemImageDetails[])].sort((a, b) => {
    if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;

    const aPos = Number.isFinite(Number(a.position)) ? Number(a.position) : 999999;
    const bPos = Number.isFinite(Number(b.position)) ? Number(b.position) : 999999;
    if (aPos !== bPos) return aPos - bPos;

    return Number(a.id) - Number(b.id);
  });

  const urls = sorted.map(
    (x) => supabase.storage.from("item-images").getPublicUrl(x.path).data.publicUrl
  );

  setImageUrls(urls);
  setActiveImageIndex(0);
} else {
  setImageUrls([]);
  setActiveImageIndex(0);
}

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select(
          "id,full_name,city,bio,avatar_path,instagram_url,facebook_url,linkedin_url,website_url,verification_status"
        )
        .eq("id", typedItem.owner_id)
        .maybeSingle();

      if (!profErr && prof) setOwner(prof as OwnerProfile);
      else setOwner(null);

      const { data: reservations, error: rErr } = await supabase
        .from("item_unavailable_ranges")
        .select("date_from,date_to")
        .eq("item_id", itemId);

      if (!rErr && reservations) {
        const ranges = (reservations as UnavailableRangeDetails[])
          .map((r) => {
            const from = parseDateOnly(r.date_from);
            const to = parseDateOnly(r.date_to);

            if (!from || !to) {
              return null;
            }

            return { from, to };
          })
          .filter((value): value is { from: Date; to: Date } => value !== null);

        setReservedRanges(ranges);
      } else {
        setReservedRanges([]);
      }

      const { data: itemAgg } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_type", "item")
        .eq("item_id", itemId);

      if (itemAgg) {
        const ratings = itemAgg
          .map((x: RatingRow) => Number(x.rating))
          .filter((n) => Number.isFinite(n));
        setItemReviewCount(ratings.length);
        setItemReviewAvg(
          ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
        );
      } else {
        setItemReviewCount(0);
        setItemReviewAvg(null);
      }

      const { data: ownerAgg } = await supabase
        .from("reviews")
        .select("rating")
        .eq("reviewee_type", "owner")
        .eq("reviewee_id", typedItem.owner_id);

      if (ownerAgg) {
        const ratings = ownerAgg
          .map((x: RatingRow) => Number(x.rating))
          .filter((n) => Number.isFinite(n));
        setOwnerReviewCount(ratings.length);
        setOwnerReviewAvg(
          ratings.length ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null
        );
      } else {
        setOwnerReviewCount(0);
        setOwnerReviewAvg(null);
      }

      const { data: list } = await supabase
        .from("reviews")
        .select("id,rating,comment,created_at,reviewee_type")
        .eq("reviewee_type", "item")
        .eq("item_id", itemId)
        .order("id", { ascending: false });

      setReviews((list ?? []) as ReviewRow[]);
      setStatus("");
    };

    if (!Number.isFinite(itemId)) return;
    run();
  }, [itemId]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;

      if (e.key === "Escape") {
        setLightboxOpen(false);
      }

      if (e.key === "ArrowLeft" && imageUrls.length > 1) {
        setActiveImageIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
      }

      if (e.key === "ArrowRight" && imageUrls.length > 1) {
        setActiveImageIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxOpen, imageUrls.length]);

  const ensureProfileExists = async (userId: string) => {
    const { data: existingProfile, error: selectError } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    if (selectError) {
      throw new Error(`Kontrola profilu zlyhala: ${selectError.message}`);
    }

    if (existingProfile) return;

    const { error: insertError } = await supabase.from("profiles").insert({
      id: userId,
    });

    if (insertError) {
      throw new Error(`Vytvorenie profilu zlyhalo: ${insertError.message}`);
    }
  };

  const startConversationWithOwner = async () => {
    if (!item) return;

    setContactingOwner(true);
    setStatus("Pripravujem konverzáciu...");

    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      if (userId === item.owner_id) {
        setStatus("Nemôžeš písať sám sebe.");
        return;
      }

      await ensureProfileExists(userId);

      const { data: existingConversation, error: existingError } = await supabase
        .from("conversations")
        .select("id")
        .eq("item_id", item.id)
        .eq("owner_id", item.owner_id)
        .eq("renter_id", userId)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existingConversation) {
        router.push(`/messages/${existingConversation.id}`);
        return;
      }

      const { data: createdConversation, error: createError } = await supabase
        .from("conversations")
        .insert({
          item_id: item.id,
          owner_id: item.owner_id,
          renter_id: userId,
        })
        .select("id")
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      router.push(`/messages/${createdConversation.id}`);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Neznáma chyba pri otváraní konverzácie.";
      setStatus("Chyba: " + message);
      alert(message);
    } finally {
      setContactingOwner(false);
    }
  };

  const reserve = async () => {
    if (!item) {
      return;
    }

    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      if (userId === item.owner_id) {
        setStatus("Vlastnu polozku si nemozes rezervovat.");
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

      setStatus("Vytvaram rezervaciu...");
      const headers = await buildItemRequestHeaders();
      headers.set("content-type", "application/json");

      const response = await fetch("/api/reservations", {
        method: "POST",
        headers,
        body: JSON.stringify({
          itemId,
          dateFrom,
          dateTo,
        }),
      });

      const payload = (await response.json().catch(() => null)) as CreateReservationResponse | null;

      if (!response.ok || !payload?.reservation?.id) {
        const msg = payload?.error ?? "Nepodarilo sa vytvorit rezervaciu.";
        setStatus("Chyba: " + msg);
        return;
      }

      router.push(`/payment?reservation_id=${payload.reservation.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznama chyba pri rezervacii.";
      setStatus("Chyba: " + message);
    }
  };

  const showPrevImage = () => {
    if (imageUrls.length <= 1) return;
    setActiveImageIndex((prev) => (prev === 0 ? imageUrls.length - 1 : prev - 1));
  };

  const showNextImage = () => {
    if (imageUrls.length <= 1) return;
    setActiveImageIndex((prev) => (prev === imageUrls.length - 1 ? 0 : prev + 1));
  };

  if (status === "Nenájdené") {
    return (
      <main className="space-y-4">
        <Link className="inline-flex text-sm text-indigo-300 hover:text-indigo-200" href={returnToItemsHref}>
          ← Späť na ponuky
        </Link>

        <div className="rentulo-card p-8">
          <div className="text-xl font-semibold">Položka neexistuje</div>
          <div className="mt-2 text-white/70">
            Táto ponuka sa nenašla alebo už nie je dostupná.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <Link className="inline-flex text-sm text-indigo-300 hover:text-indigo-200" href={returnToItemsHref}>
        ← Späť na ponuky
      </Link>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      {item ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rentulo-card p-6 md:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.city ? (
                      <span className="rounded-full bg-indigo-500/10 px-3 py-1 text-xs font-medium text-indigo-300">
                        {item.city}
                      </span>
                    ) : null}

                    {owner?.verification_status ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${verificationBadgeClass(
                          owner.verification_status
                        )}`}
                      >
                        {verificationLabel(owner.verification_status)}
                      </span>
                    ) : null}
                  </div>

                  <h1 className="mt-4 text-3xl font-semibold md:text-4xl">{item.title}</h1>

                  <div className="mt-3 text-lg text-white/85">
                    <strong className="text-white">{item.price_per_day} €</strong>
                    <span className="ml-1 text-white/60">/ deň</span>
                    {item.city ? <span className="text-white/60"> · {item.city}</span> : null}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                      {itemReviewAvg !== null
                        ? `${itemReviewAvg.toFixed(2)} ⭐ · ${itemReviewCount} hodnotení položky`
                        : "Položka zatiaľ bez hodnotenia"}
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/80">
                      {ownerReviewAvg !== null
                        ? `${ownerReviewAvg.toFixed(2)} ⭐ · ${ownerReviewCount} hodnotení prenajímateľa`
                        : "Prenajímateľ zatiaľ bez hodnotenia"}
                    </span>
                  </div>
                </div>
              </div>

              {item.description ? (
                <p className="mt-6 whitespace-pre-wrap leading-7 text-white/75">
                  {item.description}
                </p>
              ) : (
                <p className="mt-6 text-white/55">Bez popisu.</p>
              )}
            </section>

            {deliveryDescription ? (
              <section className="rentulo-card p-6">
                <div className="text-xl font-semibold">{deliveryDescription.title}</div>
                <div className="mt-2 text-sm leading-6 text-white/65">
                  {deliveryDescription.summary}
                </div>

                {deliveryDescription.detailRows.length > 0 ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    {deliveryDescription.detailRows.map((row) => (
                      <div
                        key={row.label}
                        className="rounded-xl border border-white/10 bg-black/20 p-4"
                      >
                        <div className="text-sm text-white/55">{row.label}</div>
                        <div className="mt-2 text-lg font-semibold text-white">{row.value}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}

            <section className="rentulo-card p-6">
              <div className="text-xl font-semibold">Ochrana a depozit</div>
              <div className="mt-2 space-y-3 text-sm leading-6 text-white/70">
                <p>
                  Ochrana na Rentulo znamená proces pri probléme s prenájmom. Ak sa pri prevzatí,
                  používaní alebo vrátení veci objaví problém, rieši sa cez spor alebo reklamáciu.
                </p>
                <p>
                  Depozit je interný údaj rezervácie. Presný finančný súhrn uvidíš v ďalšom kroku
                  rezervácie pred pokračovaním.
                </p>
                <p>
                  Tento detail položky nezakladá automatický pohyb peňazí ani automatické
                  blokovanie platby. Rezervácia sa dokončuje až v ďalšom kroku.
                </p>
              </div>
            </section>

            {imageUrls.length > 0 ? (
              <section className="rentulo-theme-preserve-dark space-y-3">
                <div className="relative overflow-hidden rounded-2xl border border-white/10">
                  <button type="button" onClick={() => setLightboxOpen(true)} className="block w-full">
                    <ItemPreviewImage
                      src={activeImage ?? imageUrls[0]}
                      alt="hlavná fotka"
                      frameClassName="h-[440px] w-full bg-black/30"
                      fit="cover"
                    />
                  </button>

                  {imageUrls.length > 1 ? (
                    <>
                      <button
                        type="button"
                        onClick={showPrevImage}
                        className="rentulo-image-control absolute left-4 top-1/2 -translate-y-1/2 rounded-full px-3 py-2"
                      >
                        ←
                      </button>

                      <button
                        type="button"
                        onClick={showNextImage}
                        className="rentulo-image-control absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-3 py-2"
                      >
                        →
                      </button>

                      <div className="rentulo-image-chip absolute bottom-4 right-4 rounded-full px-3 py-1 text-xs text-white">
                        {activeImageIndex + 1}/{imageUrls.length}
                      </div>
                    </>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2">
                  {imageUrls.map((u, index) => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setActiveImageIndex(index)}
                      className={`overflow-hidden rounded-xl border p-0.5 ${
                        activeImageIndex === index ? "border-indigo-400" : "border-white/10"
                      }`}
                    >
                      <ItemPreviewImage
                        src={u}
                        alt="náhľad"
                        frameClassName="h-20 w-28 rounded-lg bg-black/25"
                        fit="contain"
                      />
                    </button>
                  ))}
                </div>

                <div className="text-sm text-white/55">
                  Klikni na veľkú fotku pre zväčšenie.
                </div>
              </section>
            ) : (
              <ItemPreviewImage
                alt="Bez fotiek"
                frameClassName="rentulo-card h-64 rounded-2xl"
                fallbackLabel="Bez fotiek"
              />
            )}

            <section className="rentulo-card p-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/60">Hodnotenie položky</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {itemReviewAvg !== null ? itemReviewAvg.toFixed(2) : "-"} ⭐
                  </div>
                  <div className="mt-1 text-sm text-white/55">{itemReviewCount} hodnotení</div>
                </div>

                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm text-white/60">Hodnotenie prenajímateľa</div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {ownerReviewAvg !== null ? ownerReviewAvg.toFixed(2) : "-"} ⭐
                  </div>
                  <div className="mt-1 text-sm text-white/55">{ownerReviewCount} hodnotení</div>
                </div>
              </div>

              <div className="mt-6">
                <div className="text-xl font-semibold">Recenzie</div>

                {reviews.length === 0 ? (
                  <div className="mt-3 text-white/60">Zatiaľ bez recenzií.</div>
                ) : (
                  <ul className="mt-4 space-y-3">
                    {reviews.map((r) => (
                      <li key={r.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="font-medium text-white">{r.rating} ⭐</div>
                          <div className="text-sm text-white/55">{formatDate(r.created_at)}</div>
                        </div>

                        {r.comment ? (
                          <div className="mt-2 leading-6 text-white/75">{r.comment}</div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <section className="rentulo-card p-6">
              <div className="text-xl font-semibold">Prenajímateľ</div>

              <Link
                href={`/profile/${item.owner_id}`}
                className="mt-4 block rounded-xl transition hover:bg-white/5"
              >
                <div className="flex items-center gap-3">
                  {ownerAvatarUrl ? (
                    <img
                      src={ownerAvatarUrl}
                      alt="avatar"
                      className="h-14 w-14 rounded-full border border-white/10 object-cover"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-full border border-white/10 bg-white/5" />
                  )}

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-medium">{owner?.full_name ?? "Bez mena"}</div>

                      {owner?.verification_status ? (
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${verificationBadgeClass(
                            owner.verification_status
                          )}`}
                        >
                          {verificationLabel(owner.verification_status)}
                        </span>
                      ) : null}
                    </div>

                    <div className="text-sm text-white/60">{owner?.city ?? "Bez mesta"}</div>
                  </div>
                </div>

                <div className="mt-3 text-sm text-indigo-300">Zobraziť verejný profil →</div>
              </Link>

              {owner?.bio ? (
                <div className="mt-4 whitespace-pre-wrap text-sm leading-6 text-white/75">
                  {owner.bio}
                </div>
              ) : (
                <div className="mt-4 text-sm text-white/55">Bez popisu profilu.</div>
              )}

              {owner?.website_url ||
              owner?.instagram_url ||
              owner?.facebook_url ||
              owner?.linkedin_url ? (
                <div className="mt-5 space-y-2 text-sm">
                  {owner.website_url ? (
                    <a
                      className="block text-indigo-300 hover:text-indigo-200"
                      href={owner.website_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Web
                    </a>
                  ) : null}

                  {owner.instagram_url ? (
                    <a
                      className="block text-indigo-300 hover:text-indigo-200"
                      href={owner.instagram_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Instagram
                    </a>
                  ) : null}

                  {owner.facebook_url ? (
                    <a
                      className="block text-indigo-300 hover:text-indigo-200"
                      href={owner.facebook_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Facebook
                    </a>
                  ) : null}

                  {owner.linkedin_url ? (
                    <a
                      className="block text-indigo-300 hover:text-indigo-200"
                      href={owner.linkedin_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      LinkedIn
                    </a>
                  ) : null}
                </div>
              ) : null}

              <button
                type="button"
                className="rentulo-btn-secondary mt-5 w-full px-4 py-2.5 text-sm disabled:opacity-50"
                onClick={startConversationWithOwner}
                disabled={contactingOwner}
              >
                {contactingOwner ? "Otváram chat..." : "Napísať prenajímateľovi"}
              </button>

              {currentUserId === item.owner_id || currentUserRole === "admin" ? (
                <Link
                  href={currentUserRole === "admin" ? `/admin/items/${item.id}` : `/items/edit/${item.id}`}
                  className="rentulo-btn-secondary mt-3 block w-full px-4 py-2.5 text-center text-sm"
                >
                  Upraviť ponuku
                </Link>
              ) : null}
            </section>

            <section className="rentulo-card p-6 space-y-4">
              <div>
                <div className="text-xl font-semibold">Rezervácia</div>
                <div className="mt-1 text-sm text-white/60">
                  Vyber si voľný termín a potom dokončíš rezerváciu.
                </div>
                {isOwnerViewingOwnItem ? (
                  <div className="mt-2 text-sm text-red-200">
                    Vlastnu polozku si nemozes rezervovat.
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <div className="text-sm font-semibold text-white">
                  Dôležité pred pokračovaním
                </div>
                <div className="mt-2 space-y-2 text-sm leading-6 text-white/70">
                  <p>Na tejto stránke vidíš cenu za deň a orientačný odhad za vybraný termín.</p>
                  <p>Aktuálne podmienky dokončenia rezervácie uvidíš až v ďalšom kroku.</p>
                  <p>Rezervácia ešte nie je potvrdená len výberom dátumu.</p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20 p-3">
                <DayPicker
                  mode="range"
                  selected={range}
                  onSelect={setRange}
                  disabled={[...reservedRanges, { before: new Date() }]}
                  modifiers={{ reserved: reservedRanges }}
                  modifiersStyles={{
                    reserved: { backgroundColor: "#7f1d1d", color: "white" },
                    selected: { backgroundColor: "#ffffff", color: "black" },
                  }}
                />
              </div>

              <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/80">
                <div>
                  Vybrané:{" "}
                  <strong className="text-white">
                    {selectedFrom || "-"} → {selectedTo || "-"}
                  </strong>
                </div>

                <div className="mt-2 text-sm text-white/65">
                  Dní: <strong className="text-white">{days || "-"}</strong>
                  {estimatedTotal ? (
                    <>
                      {" "}
                      · Odhad: <strong className="text-white">{estimatedTotal} €</strong>
                    </>
                  ) : null}
                </div>
              </div>

              <button
                className="rentulo-btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50"
                onClick={reserve}
                disabled={!range?.from || !range?.to || isOwnerViewingOwnItem}
                type="button"
              >
                Rezervovať
              </button>

              <div className="text-sm text-white/55">
                Rezervované dni sú červené a nedajú sa vybrať.
              </div>
            </section>
          </div>
        </div>
      ) : null}

      {lightboxOpen && activeImage ? (
        <div className="rentulo-lightbox-backdrop fixed inset-0 z-[100] flex items-center justify-center p-4">
          <button
            type="button"
            className="rentulo-image-control absolute right-4 top-4 rounded-full px-4 py-2"
            onClick={() => setLightboxOpen(false)}
          >
            Zavrieť
          </button>

          {imageUrls.length > 1 ? (
            <>
              <button
                type="button"
                className="rentulo-image-control absolute left-4 top-1/2 -translate-y-1/2 rounded-full px-4 py-3"
                onClick={showPrevImage}
              >
                ←
              </button>

              <button
                type="button"
                className="rentulo-image-control absolute right-4 top-1/2 -translate-y-1/2 rounded-full px-4 py-3"
                onClick={showNextImage}
              >
                →
              </button>
            </>
          ) : null}

          <div className="max-h-full max-w-6xl">
            <img
              src={activeImage}
              alt="zväčšená fotka"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            />

            {imageUrls.length > 1 ? (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {imageUrls.map((u, index) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`overflow-hidden rounded-lg border ${
                      activeImageIndex === index ? "border-indigo-400" : "border-white/20"
                    }`}
                  >
                    <ItemPreviewImage
                      src={u}
                      alt={`náhľad ${index + 1}`}
                      frameClassName="h-16 w-24 bg-black/25"
                      fit="contain"
                    />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </main>
  );
}
