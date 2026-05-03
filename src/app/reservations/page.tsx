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
  payment_due_at?: string | null;
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

type ConversationRow = {
  id: number;
  item_id: number;
  owner_id: string;
  renter_id: string;
  reservation_id: number | null;
};

type OwnerProfileMeta = {
  full_name: string | null;
  city: string | null;
  verification_status: "unverified" | "pending" | "verified" | "rejected" | string;
};

type PaymentEvent = {
  id: number;
  reservation_id: number;
  event_type: string;
  provider: string | null;
  note: string | null;
  created_at: string;
};

type ItemRecord = {
  id: number;
  title: string;
  owner_id: string;
};

type OwnerProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  verification_status: OwnerProfileMeta["verification_status"];
};

type ReviewRow = {
  reservation_id: number;
  reviewee_type: "item" | "owner" | string;
};

type ConditionPhotoRow = Omit<ConditionPhoto, "signed_url">;

function verificationBadgeClass(status: string) {
  if (status === "verified") return "bg-emerald-600/90 text-white";
  if (status === "pending") return "bg-yellow-400 text-black";
  if (status === "rejected") return "bg-red-600/90 text-white";
  return "bg-white/10 text-white";
}

function verificationLabel(status: string) {
  if (status === "verified") return "Overený používateľ";
  if (status === "pending") return "Čaká na overenie";
  if (status === "rejected") return "Overenie zamietnuté";
  return "Neoverený profil";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function formatDateTime(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString("sk-SK");
}

function daysUntil(dateStr: string) {
  const now = new Date();
  const target = new Date(dateStr);

  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);

  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function hasRentalStarted(dateStr: string) {
  const now = new Date();
  const start = new Date(dateStr);

  now.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);

  return start.getTime() <= now.getTime();
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

function paymentEventLabel(eventType: string) {
  if (eventType === "payment_demo_paid") return "Demo platba úspešná";
  if (eventType === "payment_demo_failed") return "Demo platba zlyhala";
  if (eventType === "payment_expired") return "Platba expirovala";
  return eventType;
}

function CheckpointCard({
  label,
  value,
  hint,
  emphasized = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasized?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        emphasized
          ? "border-indigo-400/30 bg-indigo-500/10"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="text-[11px] uppercase tracking-wide text-white/45">{label}</div>
      <div className="mt-2 text-sm font-medium text-white/90">{value}</div>
      {hint ? <div className="mt-1 text-xs text-white/55">{hint}</div> : null}
    </div>
  );
}

export default function ReservationsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Reservation[]>([]);
  const [status, setStatus] = useState("Načítavam...");

  const [itemMetaMap, setItemMetaMap] = useState<Record<number, ItemMeta>>({});
  const [ownerProfileMap, setOwnerProfileMap] = useState<Record<string, OwnerProfileMeta>>({});
  const [reviewMap, setReviewMap] = useState<Record<number, ReviewFlags>>({});
  const [photoMap, setPhotoMap] = useState<Record<number, ConditionPhoto[]>>({});
  const [conversationMap, setConversationMap] = useState<Record<number, number>>({});
  const [paymentEventMap, setPaymentEventMap] = useState<Record<number, PaymentEvent[]>>({});
  const [chatOpeningForReservation, setChatOpeningForReservation] = useState<number | null>(null);

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
      .select("id,item_id,date_from,date_to,status,payment_status,payment_provider,payment_due_at")
      .eq("renter_id", userId)
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const reservationRows = (data ?? []) as Reservation[];
    setRows(reservationRows);

    const itemIds = Array.from(new Set(reservationRows.map((r) => r.item_id)));
    const reservationIds = reservationRows.map((r) => r.id);

    const itemsPromise =
      itemIds.length > 0
        ? supabase.from("items").select("id,title,owner_id").in("id", itemIds)
        : Promise.resolve({ data: [] as ItemRecord[], error: null });
    const paymentEventsPromise =
      reservationIds.length > 0
        ? supabase
            .from("payment_events")
            .select("id,reservation_id,event_type,provider,note,created_at")
            .in("reservation_id", reservationIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as PaymentEvent[], error: null });
    const reviewsPromise =
      reservationIds.length > 0
        ? supabase
            .from("reviews")
            .select("reservation_id,reviewee_type")
            .in("reservation_id", reservationIds)
            .eq("reviewer_id", userId)
        : Promise.resolve({ data: [] as ReviewRow[], error: null });
    const photosPromise =
      reservationIds.length > 0
        ? supabase
            .from("rental_condition_photos")
            .select("id,reservation_id,item_id,phase,actor,path,note,created_at")
            .in("reservation_id", reservationIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as ConditionPhotoRow[], error: null });

    const [itemsResult, paymentEventsResult, reviewsResult, photosResult] = await Promise.all([
      itemsPromise,
      paymentEventsPromise,
      reviewsPromise,
      photosPromise,
    ]);

    const nextItemMetaMap: Record<number, ItemMeta> = {};
    const ownerIds = new Set<string>();

    if (!itemsResult.error) {
      for (const item of (itemsResult.data ?? []) as ItemRecord[]) {
        nextItemMetaMap[item.id] = {
          title: item.title,
          owner_id: item.owner_id,
        };

        if (item.owner_id) {
          ownerIds.add(item.owner_id);
        }
      }
    }

    setItemMetaMap(nextItemMetaMap);

    const [ownerProfilesResult, conversationsResult] = await Promise.all([
      ownerIds.size > 0
        ? supabase
            .from("profiles")
            .select("id,full_name,city,verification_status")
            .in("id", Array.from(ownerIds))
        : Promise.resolve({ data: [] as OwnerProfileRow[], error: null }),
      itemIds.length > 0
        ? supabase
            .from("conversations")
            .select("id,item_id,owner_id,renter_id,reservation_id")
            .eq("renter_id", userId)
            .in("item_id", itemIds)
        : Promise.resolve({ data: [] as ConversationRow[], error: null }),
    ]);

    const nextOwnerProfileMap: Record<string, OwnerProfileMeta> = {};
    if (!ownerProfilesResult.error) {
      for (const profile of (ownerProfilesResult.data ?? []) as OwnerProfileRow[]) {
        nextOwnerProfileMap[profile.id] = {
          full_name: profile.full_name ?? null,
          city: profile.city ?? null,
          verification_status: profile.verification_status ?? "unverified",
        };
      }
    }
    setOwnerProfileMap(nextOwnerProfileMap);

    const conversationLookup = new Map<string, number>();
    if (!conversationsResult.error) {
      for (const conversation of (conversationsResult.data ?? []) as ConversationRow[]) {
        conversationLookup.set(`${conversation.item_id}:${conversation.owner_id}`, conversation.id);
      }
    }

    const nextConversationMap: Record<number, number> = {};
    for (const reservation of reservationRows) {
      const ownerId = nextItemMetaMap[reservation.item_id]?.owner_id;
      if (!ownerId) continue;

      const conversationId = conversationLookup.get(`${reservation.item_id}:${ownerId}`);
      if (conversationId) {
        nextConversationMap[reservation.id] = conversationId;
      }
    }
    setConversationMap(nextConversationMap);

    const nextPaymentEventMap: Record<number, PaymentEvent[]> = {};
    if (!paymentEventsResult.error) {
      for (const event of (paymentEventsResult.data ?? []) as PaymentEvent[]) {
        if (!nextPaymentEventMap[event.reservation_id]) {
          nextPaymentEventMap[event.reservation_id] = [];
        }
        nextPaymentEventMap[event.reservation_id].push(event);
      }
    }
    setPaymentEventMap(nextPaymentEventMap);

    const nextReviewMap: Record<number, ReviewFlags> = {};
    for (const reservation of reservationRows) {
      nextReviewMap[reservation.id] = { item: false, owner: false };
    }

    if (!reviewsResult.error) {
      for (const review of (reviewsResult.data ?? []) as ReviewRow[]) {
        if (!nextReviewMap[review.reservation_id]) {
          nextReviewMap[review.reservation_id] = { item: false, owner: false };
        }
        if (review.reviewee_type === "item" || review.reviewee_type === "item_hidden") {
          nextReviewMap[review.reservation_id].item = true;
        }
        if (review.reviewee_type === "owner" || review.reviewee_type === "owner_hidden") {
          nextReviewMap[review.reservation_id].owner = true;
        }
      }
    }
    setReviewMap(nextReviewMap);

    if (photosResult.error) {
      setPhotoMap({});
    } else {
      const photoRows = (photosResult.data ?? []) as ConditionPhotoRow[];
      const photoPaths = Array.from(
        new Set(photoRows.map((photo) => photo.path).filter((path): path is string => !!path))
      );
      const signedUrlMap = new Map<string, string | null>();

      if (photoPaths.length > 0) {
        const { data: signedUrls } = await supabase.storage
          .from("rental-condition-photos")
          .createSignedUrls(photoPaths, 60 * 60);

        for (const signed of signedUrls ?? []) {
          if (signed.path) {
            signedUrlMap.set(signed.path, signed.signedUrl ?? null);
          }
        }
      }

      const nextPhotoMap: Record<number, ConditionPhoto[]> = {};

      for (const raw of photoRows) {
        const photo: ConditionPhoto = {
          id: raw.id,
          reservation_id: raw.reservation_id,
          item_id: raw.item_id,
          phase: raw.phase,
          actor: raw.actor,
          path: raw.path,
          note: raw.note,
          created_at: raw.created_at,
          signed_url: signedUrlMap.get(raw.path) ?? null,
        };

        if (!nextPhotoMap[photo.reservation_id]) {
          nextPhotoMap[photo.reservation_id] = [];
        }
        nextPhotoMap[photo.reservation_id].push(photo);
      }

      setPhotoMap(nextPhotoMap);
    }

    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const openChatForReservation = async (reservation: Reservation) => {
    const itemMeta = itemMetaMap[reservation.item_id];
    if (!itemMeta) {
      alert("Chýbajú údaje o položke.");
      return;
    }

    setChatOpeningForReservation(reservation.id);

    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      await ensureProfileExists(userId);

      const { data: existingConversation, error: existingError } = await supabase
        .from("conversations")
        .select("id,reservation_id")
        .eq("item_id", reservation.item_id)
        .eq("owner_id", itemMeta.owner_id)
        .eq("renter_id", userId)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message);
      }

      if (existingConversation) {
        if (!existingConversation.reservation_id) {
          await supabase
            .from("conversations")
            .update({ reservation_id: reservation.id })
            .eq("id", existingConversation.id);
        }

        router.push(`/messages/${existingConversation.id}`);
        return;
      }

      const { data: createdConversation, error: createError } = await supabase
        .from("conversations")
        .insert({
          item_id: reservation.item_id,
          owner_id: itemMeta.owner_id,
          renter_id: userId,
          reservation_id: reservation.id,
        })
        .select("id")
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      router.push(`/messages/${createdConversation.id}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Neznáma chyba pri otváraní chatu.";
      alert(message);
    } finally {
      setChatOpeningForReservation(null);
    }
  };

  const getReviewSubmitErrorMessage = (error: { message?: string; code?: string } | null) => {
    if (!error) return "Neznáma chyba pri ukladaní hodnotenia.";

    if (error.code === "23505") {
      return "Toto hodnotenie už bolo odoslané.";
    }

    const message = error.message ?? "";

    if (message.toLowerCase().includes("duplicate")) {
      return "Toto hodnotenie už bolo odoslané.";
    }

    if (
      message.toLowerCase().includes("row-level security") ||
      message.toLowerCase().includes("violates row-level security")
    ) {
      return "Hodnotenie je možné pridať až po riadnom ukončení prenájmu.";
    }

    return message || "Neznáma chyba pri ukladaní hodnotenia.";
  };

  const updateReservationStatus = async (
    id: number,
    nextStatus: "return_pending_confirmation" | "cancelled"
  ) => {
    setStatus("Ukladám zmenu...");

    const rpcName =
      nextStatus === "return_pending_confirmation"
        ? "reservation_mark_return_pending_confirmation"
        : "reservation_cancel";

    const { error } = await supabase.rpc(rpcName, {
      p_reservation_id: id,
    });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    await load();
  };

  const uploadReturnPhotos = async (reservation: Reservation) => {
    if (!hasRentalStarted(reservation.date_from)) {
      alert("Fotky po vrátení môžeš nahrávať až od začiatku prenájmu.");
      setStatus("Fotky po vrátení môžeš nahrávať až od začiatku prenájmu.");
      return;
    }

    if (returnFiles.length === 0) {
      alert("Vyber aspoň jednu fotku.");
      setStatus("Najprv vyber aspoň jednu fotku.");
      return;
    }

    setReturnUploading(true);
    setStatus("Pripravujem upload...");

    try {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        alert("Musíš byť prihlásený.");
        router.push("/login");
        return;
      }

      await ensureProfileExists(userId);

      for (let i = 0; i < returnFiles.length; i++) {
        const file = returnFiles[i];
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
        const path = `${reservation.id}/return/renter/${crypto.randomUUID()}.${safeExt}`;

        setStatus(`Nahrávam fotku ${i + 1}/${returnFiles.length}...`);

        const { error: uploadError } = await supabase.storage
          .from("rental-condition-photos")
          .upload(path, file, {
            upsert: false,
            contentType: file.type || "image/jpeg",
            cacheControl: "3600",
          });

        if (uploadError) {
          throw new Error(`Storage upload zlyhal: ${uploadError.message}`);
        }

        const { error: insertError } = await supabase
          .from("rental_condition_photos")
          .insert({
            reservation_id: reservation.id,
            item_id: reservation.item_id,
            uploaded_by: userId,
            phase: "return",
            actor: "renter",
            path,
            note: returnNote.trim() ? returnNote.trim() : null,
          });

        if (insertError) {
          throw new Error(`Zápis do DB zlyhal: ${insertError.message}`);
        }
      }

      setStatus("Fotky po vrátení nahraté ✅");
      alert("Fotky po vrátení boli úspešne nahrané.");
      setOpenReturnUploadForReservation(null);
      setReturnFiles([]);
      setReturnNote("");
      await load();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Neznáma chyba pri nahrávaní fotiek.";

      setStatus("Chyba pri nahrávaní: " + message);
      alert(message);
    } finally {
      setReturnUploading(false);
    }
  };

  const submitReview = async (
    reservation: Reservation,
    revieweeType: "item" | "owner"
  ) => {
    const itemMeta = itemMetaMap[reservation.item_id];
    if (!itemMeta) {
      alert("Chýbajú údaje o položke.");
      setStatus("Chyba: chýbajú údaje o položke.");
      return;
    }

    if (reservation.status !== "completed") {
      alert("Hodnotenie je možné pridať až po riadnom ukončení prenájmu.");
      setStatus("Hodnotenie je možné pridať až po riadnom ukončení prenájmu.");
      return;
    }

    if (revieweeType === "item" && reviewMap[reservation.id]?.item) {
      alert("Vec už bola ohodnotená.");
      setStatus("Vec už bola ohodnotená.");
      return;
    }

    if (revieweeType === "owner" && reviewMap[reservation.id]?.owner) {
      alert("Prenajímateľ už bol ohodnotený.");
      setStatus("Prenajímateľ už bol ohodnotený.");
      return;
    }

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;
    if (!userId) {
      alert("Musíš byť prihlásený.");
      router.push("/login");
      return;
    }

    setReviewSubmitting(true);
    setStatus("Odosielam hodnotenie...");

    try {
      await ensureProfileExists(userId);

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
        const message = getReviewSubmitErrorMessage(error);
        setStatus("Chyba: " + message);
        alert(message);
        return;
      }

      setReviewComment("");
      setReviewRating(5);
      setOpenReviewKey(null);
      setStatus("Hodnotenie uložené ✅");
      alert("Hodnotenie bolo úspešne uložené.");
      await load();
    } finally {
      setReviewSubmitting(false);
    }
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

  const renderSection = (
    title: string,
    subtitle: string,
    content: React.ReactNode
  ) => (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      </div>
      <div className="mt-4">{content}</div>
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
                className="h-28 w-full rounded-lg border border-white/10 object-cover"
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

  const renderPaymentHistory = (reservationId: number) => {
    const events = paymentEventMap[reservationId] ?? [];

    if (events.length === 0) {
      return (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="font-medium">História platby</div>
          <div className="mt-2 text-sm text-white/50">Zatiaľ bez záznamov.</div>
        </div>
      );
    }

    return (
      <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="font-medium">História platby</div>
        <div className="mt-3 space-y-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="rounded-lg border border-white/10 bg-black/20 p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-medium text-white/90">
                  {paymentEventLabel(event.event_type)}
                </div>
                <div className="text-white/50">{formatDateTime(event.created_at)}</div>
              </div>

              <div className="mt-1 text-white/60">
                Poskytovateľ: {event.provider || "-"}
              </div>

              {event.note ? (
                <div className="mt-1 text-white/70">{event.note}</div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCard = (r: Reservation) => {
    const itemMeta = itemMetaMap[r.item_id];
    const ownerProfile = itemMeta ? ownerProfileMap[itemMeta.owner_id] : null;
    const photos = photoMap[r.id] ?? [];
    const existingConversationId = conversationMap[r.id];

    const canPay = r.status === "pending" && r.payment_status === "unpaid";
    const canCancel =
      r.status !== "cancelled" &&
      r.status !== "completed" &&
      r.status !== "in_rental" &&
      r.status !== "return_pending_confirmation";

    const canOpenDispute =
      r.status === "confirmed" ||
      r.status === "in_rental" ||
      r.status === "return_pending_confirmation";

    const renterReturnCount = photos.filter(
      (p) => p.phase === "return" && p.actor === "renter"
    ).length;

    const ownerHandoverCount = photos.filter(
      (p) => p.phase === "handover" && p.actor === "owner"
    ).length;

    const rentalStarted = hasRentalStarted(r.date_from);
    const canMarkReturned =
      r.status === "in_rental" && rentalStarted && renterReturnCount > 0;

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
      <div className="rounded-2xl border border-white/10 bg-black/20 p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-white/50">Rezervácia</span>
              <strong className="text-base">#{r.id}</strong>
            </div>

            <div className="text-white/80">
              <span className="text-white/50">Položka:</span> {itemMeta?.title ?? r.item_id}
            </div>

            {itemMeta ? (
              <div className="flex flex-wrap items-center gap-2 text-white/80">
                <span className="text-white/50">Prenajímateľ:</span>
                <Link
                  href={`/profile/${itemMeta.owner_id}`}
                  className="underline underline-offset-2 hover:text-white"
                >
                  {ownerProfile?.full_name?.trim() || "Používateľ"}
                </Link>

                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${verificationBadgeClass(
                    ownerProfile?.verification_status || "unverified"
                  )}`}
                >
                  {verificationLabel(ownerProfile?.verification_status || "unverified")}
                </span>

                {ownerProfile?.city ? (
                  <span className="text-sm text-white/50">· {ownerProfile.city}</span>
                ) : null}
              </div>
            ) : null}

            <div className="text-white/80">
              <span className="text-white/50">Termín:</span> {formatDate(r.date_from)} →{" "}
              {formatDate(r.date_to)}
            </div>

            {r.payment_due_at ? (
              <div className="text-sm text-white/60">
                Platbu treba dokončiť do:{" "}
                <strong className="text-white">{formatDateTime(r.payment_due_at)}</strong>
              </div>
            ) : null}

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

        <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm font-medium text-white/85">Priebeh a dôvera</div>
          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <CheckpointCard
              label="Stav rezervácie"
              value={reservationStatusLabel(r.status)}
              hint={countdownText}
              emphasized
            />
            <CheckpointCard
              label="Stav platby"
              value={paymentStatusLabel(r.payment_status)}
              hint={
                r.payment_due_at
                  ? `Platobný krok do ${formatDateTime(r.payment_due_at)}`
                  : "Platobný stav podľa aktuálnej rezervácie"
              }
            />
            <CheckpointCard
              label="Prevzatie"
              value={
                ownerHandoverCount > 0
                  ? "Fotky pri prevzatí sú pripravené"
                  : r.status === "pending"
                  ? "Čaká sa na potvrdenie"
                  : r.status === "confirmed"
                  ? "Čaká na prevzatie"
                  : "Zatiaľ bez dôkazových fotiek"
              }
              hint="Checkpoint pri odovzdaní od prenajímateľa"
              emphasized={ownerHandoverCount > 0}
            />
            <CheckpointCard
              label="Vrátenie"
              value={
                r.status === "completed"
                  ? "Vrátenie je potvrdené"
                  : r.status === "return_pending_confirmation"
                  ? "Čaká na potvrdenie prenajímateľa"
                  : renterReturnCount > 0
                  ? "Fotky po vrátení sú nahraté"
                  : r.status === "in_rental"
                  ? "Čaká na tvoje vrátenie"
                  : "Zatiaľ nezačalo"
              }
              hint="Záver prenájmu a potvrdenie druhej strany"
              emphasized={renterReturnCount > 0 || r.status === "return_pending_confirmation"}
            />
            <CheckpointCard
              label="Dôkaz pri prevzatí"
              value={
                ownerHandoverCount > 0
                  ? `${ownerHandoverCount} ${
                      ownerHandoverCount === 1 ? "fotka" : ownerHandoverCount < 5 ? "fotky" : "fotiek"
                    }`
                  : "Bez fotiek"
              }
              hint="Nahrané prenajímateľom"
              emphasized={ownerHandoverCount > 0}
            />
            <CheckpointCard
              label="Dôkaz pri vrátení"
              value={
                renterReturnCount > 0
                  ? `${renterReturnCount} ${
                      renterReturnCount === 1 ? "fotka" : renterReturnCount < 5 ? "fotky" : "fotiek"
                    }`
                  : "Bez fotiek"
              }
              hint="Nahraté pri vrátení"
              emphasized={renterReturnCount > 0}
            />
          </div>
        </div>

        {r.status === "confirmed" || r.status === "in_rental" || r.status === "return_pending_confirmation" ? (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="font-semibold">Dôkazové fotky pri prevzatí</div>
              <div className="mt-1 text-sm text-white/60">
                Tieto fotky ukazujú stav veci pri odovzdaní. Nahraté prenajímateľom: <strong>{ownerHandoverCount}</strong>
              </div>
              <div className="mt-3">{renderPhotoGrid(r.id, "handover", "owner")}</div>
            </div>
          </div>
        ) : null}

        {r.status === "in_rental" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-semibold">Checkpoint: vrátenie</div>
            <div className="mt-1 text-sm text-white/60">
              Najprv nahraj svoje fotky po vrátení. Až potom klikni <strong>Vrátil som</strong>.
            </div>

            {!rentalStarted ? (
              <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/60">
                Fotky po vrátení môžeš nahrávať až od dátumu začiatku prenájmu: <strong>{formatDate(r.date_from)}</strong>.
              </div>
            ) : null}

            <div className="mt-3 text-sm text-white/70">
              Tvoje nahraté fotky po vrátení: <strong>{renterReturnCount}</strong>
            </div>

            <div className="mt-3">{renderPhotoGrid(r.id, "return", "renter")}</div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                onClick={() => {
                  setOpenReturnUploadForReservation(r.id);
                  setReturnFiles([]);
                  setReturnNote("");
                }}
                disabled={!rentalStarted}
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

            {!rentalStarted ? (
              <div className="mt-3 text-sm text-white/60">
                Návratový flow sa sprístupní až v deň začiatku prenájmu.
              </div>
            ) : renterReturnCount === 0 ? (
              <div className="mt-3 text-sm text-white/60">
                Bez fotiek po vrátení nejde pokračovať.
              </div>
            ) : null}
          </div>
        ) : null}

        {r.status === "return_pending_confirmation" ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="font-semibold">Čaká sa na potvrdenie vrátenia</div>
            <div className="mt-1 text-sm text-white/60">
              Nahral si fotky po vrátení a označil si rezerváciu ako vrátenú. Teraz čakáš, kým prenajímateľ skontroluje stav a potvrdí ukončenie.
            </div>

            <div className="mt-4">
              <div className="text-sm font-medium text-white/80">Dôkazové fotky po vrátení</div>
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

          {canOpenDispute ? (
            <Link
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              href={`/disputes/new?reservation_id=${r.id}`}
            >
              Nahlásiť problém
            </Link>
          ) : null}

          {r.status === "disputed" ? (
            <Link
              className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              href="/disputes"
            >
              Otvoriť spor
            </Link>
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

          <button
            type="button"
            className="rounded border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
            onClick={() => openChatForReservation(r)}
            disabled={chatOpeningForReservation === r.id}
          >
            {chatOpeningForReservation === r.id
              ? "Otváram chat..."
              : existingConversationId
              ? "Otvoriť chat"
              : "Vytvoriť chat"}
          </button>

          <Link
            className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
            href={`/items/${r.item_id}`}
          >
            Detail ponuky
          </Link>
        </div>

        {r.status === "disputed" ? (
          <div className="mt-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-white/80">
            Táto rezervácia je označená ako spor. Skontroluj detail sporu a ďalšiu komunikáciu v chate.
          </div>
        ) : null}

        {openReturnUploadForReservation === r.id ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
            <div className="font-medium">Upload fotiek po vrátení</div>

            <input
              id={`renter-return-upload-${r.id}`}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              disabled={returnUploading}
              onChange={(e) => setReturnFiles(Array.from(e.target.files ?? []))}
            />

            <label
              htmlFor={`renter-return-upload-${r.id}`}
              className={`inline-flex cursor-pointer rounded border border-white/15 px-4 py-2 hover:bg-white/10 ${
                returnUploading ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Vybrať súbory
            </label>

            <textarea
              className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
              rows={3}
              placeholder="Poznámka k stavu po vrátení (voliteľné)"
              value={returnNote}
              onChange={(e) => setReturnNote(e.target.value)}
              disabled={returnUploading}
            />

            {returnFiles.length > 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                <div className="font-medium text-white">Vybrané súbory:</div>
                <div className="mt-1">{returnFiles.map((f) => f.name).join(", ")}</div>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/50">
                Zatiaľ nie sú vybrané žiadne súbory.
              </div>
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

        {renderPaymentHistory(r.id)}

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
                  disabled={reviewSubmitting}
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
                  disabled={reviewSubmitting}
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
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                    type="button"
                    onClick={() => setOpenReviewKey(null)}
                    disabled={reviewSubmitting}
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
                  disabled={reviewSubmitting}
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
                  disabled={reviewSubmitting}
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
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                    type="button"
                    onClick={() => setOpenReviewKey(null)}
                    disabled={reviewSubmitting}
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
      </div>
    );
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Moje rezervácie</h1>
            <p className="mt-1 text-white/60">
              Sleduj rezerváciu, stav platby a dôkazové fotky od prevzatia až po vrátenie.
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

      {renderSection(
        "Čakajúce rezervácie",
        "Rezervácie, kde ešte chýba potvrdenie alebo ďalší platobný krok.",
        pending.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne čakajúce rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((r) => (
              <li key={r.id}>{renderCard(r)}</li>
            ))}
          </ul>
        )
      )}

      {renderSection(
        "Potvrdené rezervácie",
        "Rezervácie schválené prenajímateľom a pripravené na bezpečné prevzatie.",
        confirmed.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne potvrdené rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {confirmed.map((r) => (
              <li key={r.id}>{renderCard(r)}</li>
            ))}
          </ul>
        )
      )}

      {renderSection(
        "Prebieha prenájom",
        "Vec je u teba. Pred vrátením nahraj dôkazové fotky a potom potvrď vrátenie.",
        inRental.length === 0 ? (
          <p className="text-white/60">Momentálne nemáš žiadny aktívny prenájom.</p>
        ) : (
          <ul className="space-y-3">
            {inRental.map((r) => (
              <li key={r.id}>{renderCard(r)}</li>
            ))}
          </ul>
        )
      )}

      {renderSection(
        "Čaká na potvrdenie vrátenia",
        "Fotky sú nahraté a prenajímateľ ešte kontroluje stav po vrátení.",
        returnPending.length === 0 ? (
          <p className="text-white/60">Žiadne rezervácie nečakajú na potvrdenie vrátenia.</p>
        ) : (
          <ul className="space-y-3">
            {returnPending.map((r) => (
              <li key={r.id}>{renderCard(r)}</li>
            ))}
          </ul>
        )
      )}

      {renderSection(
        "Dokončené rezervácie",
        "Prenájmy, ktoré sú riadne ukončené.",
        completed.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne dokončené rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {completed.map((r) => (
              <li key={r.id}>{renderCard(r)}</li>
            ))}
          </ul>
        )
      )}

      {renderSection(
        "Sporné rezervácie",
        "Rezervácie, pri ktorých bol nahlásený problém.",
        disputed.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne sporné rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {disputed.map((r) => (
              <li key={r.id}>{renderCard(r)}</li>
            ))}
          </ul>
        )
      )}

      {renderSection(
        "Zrušené rezervácie",
        "História zrušených rezervácií.",
        cancelled.length === 0 ? (
          <p className="text-white/60">Nemáš žiadne zrušené rezervácie.</p>
        ) : (
          <ul className="space-y-3">
            {cancelled.map((r) => (
              <li key={r.id}>{renderCard(r)}</li>
            ))}
          </ul>
        )
      )}
    </main>
  );
}
