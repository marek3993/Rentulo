"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ReservationStatus =
  | "pending"
  | "confirmed"
  | "in_rental"
  | "return_pending_confirmation"
  | "completed"
  | "cancelled"
  | "disputed"
  | string;

type PaymentStatus = "unpaid" | "paid" | "failed" | string;

type Reservation = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  payment_provider: string;
};

type ItemMeta = {
  title: string;
  owner_id: string;
};

type ReviewFlags = {
  item: boolean;
  owner: boolean;
};

type ConditionPhoto = {
  id: number;
  reservation_id: number;
  item_id: number;
  phase: "handover" | "return";
  actor: "owner" | "renter";
  path: string;
  note: string | null;
  created_at: string;
  signed_url: string | null;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function daysUntil(dateStr: string) {
  const now = new Date();
  const target = new Date(dateStr);

  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function reservationBadge(status: ReservationStatus) {
  if (status === "pending") return "bg-yellow-400 text-black";
  if (status === "confirmed") return "bg-green-600/90 text-white";
  if (status === "in_rental") return "bg-blue-600/90 text-white";
  if (status === "return_pending_confirmation") return "bg-orange-500 text-white";
  if (status === "completed") return "bg-emerald-700 text-white";
  if (status === "cancelled") return "bg-red-600/90 text-white";
  if (status === "disputed") return "bg-purple-600/90 text-white";
  return "bg-white/10 text-white";
}

function paymentBadge(status: PaymentStatus) {
  if (status === "paid") return "bg-green-600/90 text-white";
  if (status === "failed") return "bg-red-600/90 text-white";
  return "bg-yellow-400 text-black";
}

function reservationStatusLabel(status: ReservationStatus) {
  if (status === "pending") return "Čaká na potvrdenie";
  if (status === "confirmed") return "Potvrdená";
  if (status === "in_rental") return "Prebieha prenájom";
  if (status === "return_pending_confirmation") return "Čaká na potvrdenie vrátenia";
  if (status === "completed") return "Dokončená";
  if (status === "cancelled") return "Zrušená";
  if (status === "disputed") return "V spore";
  return status;
}

function paymentStatusLabel(status: PaymentStatus) {
  if (status === "paid") return "Zaplatené";
  if (status === "failed") return "Platba zlyhala";
  return "Nezaplatené";
}

export default function ReservationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [status, setStatus] = useState("Načítavam...");

  const [itemMetaMap, setItemMetaMap] = useState<Record<number, ItemMeta>>({});
  const [reviewMap, setReviewMap] = useState<Record<number, ReviewFlags>>({});
  const [photoMap, setPhotoMap] = useState<Record<number, ConditionPhoto[]>>({});

  const [openReviewKey, setOpenReviewKey] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  const [openReturnUploadForReservation, setOpenReturnUploadForReservation] = useState<number | null>(null);
  const [returnFiles, setReturnFiles] = useState<File[]>([]);
  const [returnNote, setReturnNote] = useState("");
  const [returnUploading, setReturnUploading] = useState(false);

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_provider")
      .eq("renter_id", userId)
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const reservationRows = (data ?? []) as Reservation[];
    setRows(reservationRows);

    const itemIds = Array.from(new Set(reservationRows.map((r) => r.item_id)));
    if (itemIds.length > 0) {
      const { data: itemsData, error: itemsErr } = await supabase
        .from("items")
        .select("id,title,owner_id")
        .in("id", itemIds);

      if (!itemsErr) {
        const map: Record<number, ItemMeta> = {};
        for (const item of (itemsData ?? []) as any[]) {
          map[item.id] = {
            title: item.title,
            owner_id: item.owner_id,
          };
        }
        setItemMetaMap(map);
      }
    } else {
      setItemMetaMap({});
    }

    const reservationIds = reservationRows.map((r) => r.id);
    if (reservationIds.length > 0) {
      const { data: reviewsData, error: reviewsErr } = await supabase
        .from("reviews")
        .select("reservation_id,reviewee_type")
        .in("reservation_id", reservationIds)
        .eq("reviewer_id", userId);

      if (!reviewsErr) {
        const map: Record<number, ReviewFlags> = {};
        for (const r of reservationRows) {
          map[r.id] = { item: false, owner: false };
        }

        for (const rev of (reviewsData ?? []) as any[]) {
          if (!map[rev.reservation_id]) {
            map[rev.reservation_id] = { item: false, owner: false };
          }
          if (rev.reviewee_type === "item") map[rev.reservation_id].item = true;
          if (rev.reviewee_type === "owner") map[rev.reservation_id].owner = true;
        }

        setReviewMap(map);
      }
    } else {
      setReviewMap({});
    }

    if (reservationIds.length > 0) {
      const { data: photosData, error: photosErr } = await supabase
        .from("rental_condition_photos")
        .select("id,reservation_id,item_id,phase,actor,path,note,created_at")
        .in("reservation_id", reservationIds)
        .order("created_at", { ascending: false });

      if (!photosErr) {
        const map: Record<number, ConditionPhoto[]> = {};

        for (const raw of (photosData ?? []) as any[]) {
          let signedUrl: string | null = null;

          const { data: signed } = await supabase.storage
            .from("rental-condition-photos")
            .createSignedUrl(raw.path, 60 * 60);

          signedUrl = signed?.signedUrl ?? null;

          const photo: ConditionPhoto = {
            id: raw.id,
            reservation_id: raw.reservation_id,
            item_id: raw.item_id,
            phase: raw.phase,
            actor: raw.actor,
            path: raw.path,
            note: raw.note,
            created_at: raw.created_at,
            signed_url: signedUrl,
          };

          if (!map[photo.reservation_id]) {
            map[photo.reservation_id] = [];
          }
          map[photo.reservation_id].push(photo);
        }

        setPhotoMap(map);
      }
    } else {
      setPhotoMap({});
    }

    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateReservationStatus = async (
    id: number,
    nextStatus: "return_pending_confirmation" | "cancelled" | "disputed"
  ) => {
    setStatus("Ukladám zmenu...");

    const { error } = await supabase
      .from("reservations")
      .update({ status: nextStatus })
      .eq("id", id);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    await load();
  };

  const uploadReturnPhotos = async (reservation: Reservation) => {
    if (returnFiles.length === 0) {
      setStatus("Najprv vyber aspoň jednu fotku.");
      return;
    }

    setReturnUploading(true);
    setStatus("Nahrávam fotky po vrátení...");

    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) {
        router.push("/login");
        return;
      }

      for (let i = 0; i < returnFiles.length; i++) {
        const file = returnFiles[i];
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
        const path = `${reservation.id}/return/renter/${crypto.randomUUID()}.${safeExt}`;

        const { error: upErr } = await supabase.storage
          .from("rental-condition-photos")
          .upload(path, file, { upsert: false });

        if (upErr) throw new Error(upErr.message);

        const { error: dbErr } = await supabase.from("rental_condition_photos").insert({
          reservation_id: reservation.id,
          item_id: reservation.item_id,
          uploaded_by: userId,
          phase: "return",
          actor: "renter",
          path,
          note: returnNote.trim() ? returnNote.trim() : null,
        });

        if (dbErr) throw new Error(dbErr.message);
      }

      setStatus("Fotky po vrátení nahraté ✅");
      setReturnUploading(false);
      setOpenReturnUploadForReservation(null);
      setReturnFiles([]);
      setReturnNote("");
      await load();
    } catch (err: any) {
      setReturnUploading(false);
      setStatus("Chyba: " + (err?.message ?? "upload failed"));
    }
  };

  const submitReview = async (
    reservation: Reservation,
    revieweeType: "item" | "owner"
  ) => {
    const itemMeta = itemMetaMap[reservation.item_id];
    if (!itemMeta) {
      setStatus("Chyba: chýbajú údaje o položke.");
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) {
      router.push("/login");
      return;
    }

    setReviewSubmitting(true);
    setStatus("Odosielam hodnotenie...");

    const { error } = await supabase.from("reviews").insert({
      reservation_id: reservation.id,
      item_id: reservation.item_id,
      reviewer_id: userId,
      rating: reviewRating,
      comment: reviewComment.trim() ? reviewComment.trim() : null,
      reviewee_type: revieweeType,
      reviewee_id: itemMeta.owner_id,
    });

    if (error) {
      setReviewSubmitting(false);
      setStatus("Chyba: " + error.message);
      return;
    }

    setReviewSubmitting(false);
    setReviewComment("");
    setReviewRating(5);
    setOpenReviewKey(null);
    setStatus("Hodnotenie uložené ✅");
    await load();
  };

  const pending = useMemo(() => rows.filter((r) => r.status === "pending"), [rows]);
  const confirmed = useMemo(() => rows.filter((r) => r.status === "confirmed"), [rows]);
  const inRental = useMemo(() => rows.filter((r) => r.status === "in_rental"), [rows]);
  const returnPending = useMemo(
    () => rows.filter((r) => r.status === "return_pending_confirmation"),
    [rows]
  );
  const completed = useMemo(() => rows.filter((r) => r.status === "completed"), [rows]);
  const disputed = useMemo(() => rows.filter((r) => r.status === "disputed"), [rows]);
  const cancelled = useMemo(() => rows.filter((r) => r.status === "cancelled"), [rows]);

  const SectionCard = ({
    title,
    subtitle,
    children,
  }: {
    title: string;
    subtitle: string;
    children: React.ReactNode;
  }) => (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );

  const renderPhotoGrid = (
    reservationId: number,
    phase: "handover" | "return",
    actor?: "owner" | "renter"
  ) => {
    const photos = (photoMap[reservationId] ?? []).filter((p) => {
      if (actor) return p.phase === phase && p.actor === actor;
      return p.phase === phase;
    });

    if (photos.length === 0) {
      return <div className="text-sm text-white/50">Zatiaľ bez fotiek.</div>;
    }

    return (
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <div key={p.id} className="rounded-xl border border-white/10 bg-white/5 p-2">
            {p.signed_url ? (
              <img
                src={p.signed_url}
                alt="condition photo"
                className="h-28 w-full rounded-lg object-cover border border-white/10"
              />
            ) : (
              <div className="flex h-28 items-center justify-center rounded-lg border border-white/10 bg-black/20 text-white/50">
                Bez náhľadu
              </div>
            )}

            <div className="mt-2 text-xs text-white/50">
              {p.actor === "owner" ? "Prenajímateľ" : "Zákazník"} · {formatDate(p.created_at)}
            </div>

            {p.note ? <div className="mt-1 text-sm text-white/70">{p.note}</div> : null}
          </div>
        ))}
      </div>
    );
  };

  const Card = ({ r }: { r: Reservation }) => {
    const itemMeta = itemMetaMap[r.item_id];
    const photos = photoMap[r.id] ?? [];

    const canPay = r.status === "pending" && r.payment_status === "unpaid";
    const canCancel =
      r.status !== "cancelled" &&
      r.status !== "completed" &&
      r.status !== "in_rental" &&
      r.status !== "return_pending_confirmation";

    const canDispute =
      r.status === "confirmed" ||
      r.status === "in_rental" ||
      r.status === "return_pending_confirmation";

    const renterReturnCount = photos.filter(
      (p) => p.phase === "return" && p.actor === "renter"
    ).length;

    const ownerHandoverCount = photos.filter(
      (p) => p.phase === "handover" && p.actor === "owner"
    ).length;

    const canMarkReturned = r.status === "in_rental" && renterReturnCount > 0;

    const canReviewItem = r.status === "completed" && !reviewMap[r.id]?.item;
    const canReviewOwner = r.status === "completed" && !reviewMap[r.id]?.owner;

    const reviewItemKey = `item-${r.id}`;
    const reviewOwnerKey = `owner-${r.id}`;

    const startIn = daysUntil(r.date_from);
    const endIn = daysUntil(r.date_to);

    const countdownText =
      r.status === "cancelled"
        ? "Táto rezervácia je zrušená."
        : r.status === "completed"
        ? "Prenájom je úspešne ukončený."
        : startIn > 0
        ? `Začína o ${startIn} ${startIn === 1 ? "deň" : startIn < 5 ? "dni" : "dní"}.`
        : endIn >= 0
        ? "Prenájom práve prebieha alebo začína dnes."
        : "Termín už uplynul.";

    return (
      <li className="rounded-2xl border border-white/10 bg-black/20 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-white/50">Rezervácia</span>
              <strong className="text-base">#{r.id}</strong>
            </div>

            <div className="text-white/80">
              <span className="text-white/50">Položka:</span> {itemMeta?.title ?? r.item_id}
            </div>

            <div className="text-white/80">
              <span className="text-white/50">Termín:</span> {formatDate(r.date_from)} →{" "}
              {formatDate(r.date_to)}
            </div>

            <div className="text-sm text-white/60">{countdownText}</div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${reservationBadge(
                r.status
              )}`}
            >
              {reservationStatusLabel(r.status)}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${paymentBadge(
                r.payment_status
              )}`}
            >
              {paymentStatusLabel(r.payment_status)}
            </span>
          </div>
        </div>

        <div className="mt-4 text-sm text-white/50">
          Poskytovateľ platby: {r.payment_provider}
        </div>

        {r.status === "confirmed" || r.status === "in_rental" || r.status === "return_pending_confirmation" ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="font-semibold">Fotky pri odovzdaní od prenajímateľa</div>
              <div className="mt-1 text-sm text-white/60">
                Tieto fotky ukazujú stav veci pri odovzdaní. Nahraté prenajímateľom: <strong>{ownerHandoverCount}</strong>
              </div>
              <div className="mt-3">{renderPhotoGrid(r.id, "handover", "owner")}</div>
            </div>
          </div>
        ) : null}

        {r.status === "in_rental" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-semibold">Krok: vrátenie veci</div>
            <div className="mt-1 text-sm text-white/60">
              Najprv nahraj svoje fotky po vrátení. Až potom klikni <strong>Vrátil som</strong>.
            </div>

            <div className="mt-3 text-sm text-white/70">
              Tvoje nahraté fotky po vrátení: <strong>{renterReturnCount}</strong>
            </div>

            <div className="mt-3">{renderPhotoGrid(r.id, "return", "renter")}</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                onClick={() => {
                  setOpenReturnUploadForReservation(r.id);
                  setReturnFiles([]);
                  setReturnNote("");
                }}
              >
                Nahrať fotky po vrátení
              </button>

              <button
                className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                onClick={() => updateReservationStatus(r.id, "return_pending_confirmation")}
                disabled={!canMarkReturned}
                type="button"
              >
                Vrátil som
              </button>
            </div>

            {renterReturnCount === 0 ? (
              <div className="mt-3 text-sm text-white/60">
                Bez fotiek po vrátení nejde pokračovať.
              </div>
            ) : null}
          </div>
        ) : null}

        {r.status === "return_pending_confirmation" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-semibold">Čaká sa na potvrdenie prenajímateľa</div>
            <div className="mt-1 text-sm text-white/60">
              Nahral si fotky po vrátení a označil si rezerváciu ako vrátenú. Teraz čakáš, kým prenajímateľ skontroluje stav a potvrdí ukončenie.
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-white/80">Tvoje fotky po vrátení</div>
              <div className="mt-3">{renderPhotoGrid(r.id, "return", "renter")}</div>
            </div>
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap gap-2">
          {canPay ? (
            <Link
              className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
              href={`/payment?reservation_id=${r.id}`}
            >
              Dokončiť platbu
            </Link>
          ) : null}

          {canDispute ? (
            <button
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              onClick={() => updateReservationStatus(r.id, "disputed")}
              type="button"
            >
              Nahlásiť problém
            </button>
          ) : null}

          {canCancel ? (
            <button
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              onClick={() => updateReservationStatus(r.id, "cancelled")}
              type="button"
            >
              Zrušiť rezerváciu
            </button>
          ) : null}

          <Link
            className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
            href={`/items/${r.item_id}`}
          >
            Detail ponuky
          </Link>
        </div>

        {openReturnUploadForReservation === r.id ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="font-medium">Upload fotiek po vrátení</div>

            <input
              type="file"
              accept="image/*"
              multiple
              disabled={returnUploading}
              onChange={(e) => setReturnFiles(Array.from(e.target.files ?? []))}
            />

            <textarea
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              rows={3}
              placeholder="Poznámka k stavu po vrátení (voliteľné)"
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              disabled={returnUploading}
            />

            {returnFiles.length > 0 ? (
              <div className="text-sm text-white/60">
                Vybrané fotky: {returnFiles.map((f) => f.name).join(", ")}
              </div>
            ) : (
              <div className="text-sm text-white/50">Zatiaľ nie sú vybrané žiadne fotky.</div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                disabled={returnUploading}
                onClick={() => uploadReturnPhotos(r)}
              >
                {returnUploading ? "Nahrávam..." : "Nahrať fotky"}
              </button>

              <button
                type="button"
                className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                disabled={returnUploading}
                onClick={() => {
                  setOpenReturnUploadForReservation(null);
                  setReturnFiles([]);
                  setReturnNote("");
                }}
              >
                Zrušiť
              </button>
            </div>
          </div>
        ) : null}

        {r.status === "completed" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-medium">Hodnotenie po ukončení prenájmu</div>

            <div className="mt-3 flex flex-wrap gap-2">
              {canReviewItem ? (
                <button
                  type="button"
                  className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                  onClick={() => {
                    setOpenReviewKey(reviewItemKey);
                    setReviewRating(5);
                    setReviewComment("");
                  }}
                >
                  Ohodnotiť vec
                </button>
              ) : (
                <span className="rounded border border-white/10 px-4 py-2 text-sm text-white/60">
                  Vec už ohodnotená
                </span>
              )}

              {canReviewOwner ? (
                <button
                  type="button"
                  className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                  onClick={() => {
                    setOpenReviewKey(reviewOwnerKey);
                    setReviewRating(5);
                    setReviewComment("");
                  }}
                >
                  Ohodnotiť prenajímateľa
                </button>
              ) : (
                <span className="rounded border border-white/10 px-4 py-2 text-sm text-white/60">
                  Prenajímateľ už ohodnotený
                </span>
              )}
            </div>

            {openReviewKey === reviewItemKey ? (
              <div className="mt-4 space-y-3">
                <div className="text-sm text-white/70">Hodnotíš vec</div>

                <select
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ⭐
                    </option>
                  ))}
                </select>

                <textarea
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  rows={3}
                  placeholder="Komentár k veci"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                    type="button"
                    disabled={reviewSubmitting}
                    onClick={() => submitReview(r, "item")}
                  >
                    {reviewSubmitting ? "Odosielam..." : "Odoslať hodnotenie veci"}
                  </button>

                  <button
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                    type="button"
                    onClick={() => setOpenReviewKey(null)}
                  >
                    Zrušiť
                  </button>
                </div>
              </div>
            ) : null}

            {openReviewKey === reviewOwnerKey ? (
              <div className="mt-4 space-y-3">
                <div className="text-sm text-white/70">Hodnotíš prenajímateľa</div>

                <select
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ⭐
                    </option>
                  ))}
                </select>

                <textarea
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  rows={3}
                  placeholder="Komentár k prenajímateľovi"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                    type="button"
                    disabled={reviewSubmitting}
                    onClick={() => submitReview(r, "owner")}
                  >
                    {reviewSubmitting ? "Odosielam..." : "Odoslať hodnotenie prenajímateľa"}
                  </button>

                  <button
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                    type="button"
                    onClick={() => setOpenReviewKey(null)}
                  >
                    Zrušiť
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {r.status === "pending" && r.payment_status === "paid" ? (
          <div className="mt-3 text-sm text-white/60">
            Platba je zaevidovaná. Čaká sa na potvrdenie prenajímateľa.
          </div>
        ) : null}
      </li>
    );
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Moje rezervácie</h1>
            <p className="mt-1 text-white/60">
              Jasný postup od prevzatia až po vrátenie a hodnotenie.
            </p>
          </div>

          <Link
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
            href="/items"
          >
            Prejsť na ponuky
          </Link>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      <SectionCard
        title="Čakajúce rezervácie"
        subtitle="Rezervácie čakajúce na potvrdenie alebo na platbu."
      >
        {pending.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne čakajúce rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Potvrdené rezervácie"
        subtitle="Rezervácie schválené prenajímateľom a pripravené na odovzdanie."
      >
        {confirmed.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne potvrdené rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {confirmed.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Prebieha prenájom"
        subtitle="Vec je u teba. Pred vrátením nahraj fotky a potom potvrď vrátenie."
      >
        {inRental.length === 0 ? (
          <p className="text-white/60">Momentálne nemáš žiadny aktívny prenájom.</p>
        ) : (
          <ul className="space-y-3">
            {inRental.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Čaká na potvrdenie vrátenia"
        subtitle="Prenajímateľ ešte kontroluje stav po vrátení."
      >
        {returnPending.length === 0 ? (
          <p className="text-white/60">Žiadne rezervácie nečakajú na potvrdenie vrátenia.</p>
        ) : (
          <ul className="space-y-3">
            {returnPending.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Dokončené rezervácie"
        subtitle="Prenájmy, ktoré sú riadne ukončené."
      >
        {completed.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne dokončené rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {completed.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Sporné rezervácie"
        subtitle="Rezervácie, pri ktorých bol nahlásený problém."
      >
        {disputed.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne sporné rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {disputed.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        title="Zrušené rezervácie"
        subtitle="História zrušených rezervácií."
      >
        {cancelled.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne zrušené rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {cancelled.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        )}
      </SectionCard>
    </main>
  );
}