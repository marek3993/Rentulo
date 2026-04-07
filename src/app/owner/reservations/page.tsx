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

type Row = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  status: ReservationStatus;
  payment_status: PaymentStatus;
  payment_provider: string;
  payment_due_at?: string | null;
  renter_id: string;
};

type ItemRow = {
  id: number;
  title: string;
  owner_id: string;
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

type RenterProfileMeta = {
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

type RenterProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  verification_status: RenterProfileMeta["verification_status"];
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

function shortId(id: string) {
  if (!id) return "-";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
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

export default function OwnerReservationsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Načítavam...");
  const [itemTitleMap, setItemTitleMap] = useState<Record<number, string>>({});
  const [photoMap, setPhotoMap] = useState<Record<number, ConditionPhoto[]>>({});
  const [conversationMap, setConversationMap] = useState<Record<number, number>>({});
  const [renterProfileMap, setRenterProfileMap] = useState<Record<string, RenterProfileMeta>>({});
  const [paymentEventMap, setPaymentEventMap] = useState<Record<number, PaymentEvent[]>>({});
  const [chatOpeningForReservation, setChatOpeningForReservation] = useState<number | null>(null);

  const [openUploadKey, setOpenUploadKey] = useState<string | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadNote, setUploadNote] = useState("");
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { data: ownedItems, error: itemErr } = await supabase
      .from("items")
      .select("id,title,owner_id")
      .eq("owner_id", userId)
      .order("id", { ascending: false });

    if (itemErr) {
      setStatus("Chyba: " + itemErr.message);
      return;
    }

    const itemRows = (ownedItems ?? []) as ItemRow[];

    const titleMap: Record<number, string> = {};
    for (const item of itemRows) {
      titleMap[item.id] = item.title;
    }
    setItemTitleMap(titleMap);

    const itemIds = itemRows.map((i) => i.id);
    if (itemIds.length === 0) {
      setRows([]);
      setPhotoMap({});
      setConversationMap({});
      setRenterProfileMap({});
      setPaymentEventMap({});
      setStatus("");
      return;
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_provider,payment_due_at,renter_id")
      .in("item_id", itemIds)
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const reservationRows = (data ?? []) as Row[];
    setRows(reservationRows);

    const renterIds = Array.from(
      new Set(reservationRows.map((r) => r.renter_id).filter(Boolean))
    );
    const reservationIds = reservationRows.map((r) => r.id);

    if (reservationIds.length === 0) {
      setRenterProfileMap({});
      setConversationMap({});
      setPhotoMap({});
      setPaymentEventMap({});
      setStatus("");
      return;
    }

    const [renterProfilesResult, conversationsResult, paymentEventsResult, photosResult] =
      await Promise.all([
        renterIds.length > 0
          ? supabase
              .from("profiles")
              .select("id,full_name,city,verification_status")
              .in("id", renterIds)
          : Promise.resolve({ data: [] as RenterProfileRow[], error: null }),
        supabase
          .from("conversations")
          .select("id,item_id,owner_id,renter_id,reservation_id")
          .eq("owner_id", userId)
          .in("item_id", itemIds),
        supabase
          .from("payment_events")
          .select("id,reservation_id,event_type,provider,note,created_at")
          .in("reservation_id", reservationIds)
          .order("created_at", { ascending: false }),
        supabase
          .from("rental_condition_photos")
          .select("id,reservation_id,item_id,phase,actor,path,note,created_at")
          .in("reservation_id", reservationIds)
          .order("created_at", { ascending: false }),
      ]);

    const nextRenterMap: Record<string, RenterProfileMeta> = {};
    if (!renterProfilesResult.error) {
      for (const profile of (renterProfilesResult.data ?? []) as RenterProfileRow[]) {
        nextRenterMap[profile.id] = {
          full_name: profile.full_name ?? null,
          city: profile.city ?? null,
          verification_status: profile.verification_status ?? "unverified",
        };
      }
    }
    setRenterProfileMap(nextRenterMap);

    const conversationLookup = new Map<string, number>();
    if (!conversationsResult.error) {
      for (const conversation of (conversationsResult.data ?? []) as ConversationRow[]) {
        conversationLookup.set(`${conversation.item_id}:${conversation.renter_id}`, conversation.id);
      }
    }

    const nextConversationMap: Record<number, number> = {};
    for (const reservation of reservationRows) {
      const conversationId = conversationLookup.get(
        `${reservation.item_id}:${reservation.renter_id}`
      );

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

    if (photosResult.error) {
      setPhotoMap({});
      setStatus("");
      return;
    }

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
        signedUrlMap.set(signed.path, signed.signedUrl ?? null);
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

  const openChatForReservation = async (reservation: Row) => {
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
        .eq("owner_id", userId)
        .eq("renter_id", reservation.renter_id)
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
          owner_id: userId,
          renter_id: reservation.renter_id,
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

  const updateReservationStatus = async (
    id: number,
    nextStatus:
      | "confirmed"
      | "in_rental"
      | "completed"
      | "cancelled"
      | "disputed"
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

  const startUpload = (reservationId: number, phase: "handover" | "return") => {
    setOpenUploadKey(`${reservationId}-${phase}`);
    setUploadFiles([]);
    setUploadNote("");
  };

  const uploadConditionPhotos = async (reservation: Row, phase: "handover" | "return") => {
    if (uploadFiles.length === 0) {
      alert("Vyber aspoň jednu fotku.");
      setStatus("Najprv vyber aspoň jednu fotku.");
      return;
    }

    setUploading(true);
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

      for (let i = 0; i < uploadFiles.length; i++) {
        const file = uploadFiles[i];
        const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
        const path = `${reservation.id}/${phase}/owner/${crypto.randomUUID()}.${safeExt}`;

        setStatus(`Nahrávam fotku ${i + 1}/${uploadFiles.length}...`);

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
            phase,
            actor: "owner",
            path,
            note: uploadNote.trim() ? uploadNote.trim() : null,
          });

        if (insertError) {
          throw new Error(`Zápis do DB zlyhal: ${insertError.message}`);
        }
      }

      setStatus("Fotky nahraté ✅");
      alert("Fotky stavu boli úspešne nahrané.");
      setOpenUploadKey(null);
      setUploadFiles([]);
      setUploadNote("");
      await load();
    } catch (err) {
      console.error("Owner condition upload failed:", err);
      const message =
        err instanceof Error ? err.message : "Neznáma chyba pri nahrávaní fotiek.";

      setStatus("Chyba pri nahrávaní: " + message);
      alert(message);
    } finally {
      setUploading(false);
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

  const SummaryCard = ({
    title,
    value,
    subtitle,
  }: {
    title: string;
    value: number;
    subtitle: string;
  }) => (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="text-sm text-white/60">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-white/50">{subtitle}</div>
    </div>
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

              {event.note ? <div className="mt-1 text-white/70">{event.note}</div> : null}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSection = (title: string, subtitle: string, sectionRows: Row[]) => (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      </div>

      {sectionRows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
          V tejto sekcii zatiaľ nič nie je.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {sectionRows.map((r) => {
            const startIn = daysUntil(r.date_from);
            const photos = photoMap[r.id] ?? [];
            const existingConversationId = conversationMap[r.id];
            const renterProfile = renterProfileMap[r.renter_id];

            const handoverOwnerCount = photos.filter(
              (p) => p.phase === "handover" && p.actor === "owner"
            ).length;

            const returnOwnerCount = photos.filter(
              (p) => p.phase === "return" && p.actor === "owner"
            ).length;

            const returnRenterCount = photos.filter(
              (p) => p.phase === "return" && p.actor === "renter"
            ).length;

            const canConfirm = r.status === "pending" && r.payment_status === "paid";
            const canMarkHandedOver = r.status === "confirmed" && handoverOwnerCount > 0;
            const canConfirmReturn =
              r.status === "return_pending_confirmation" &&
              returnOwnerCount > 0 &&
              returnRenterCount > 0;

            const canCancel =
              r.status !== "cancelled" &&
              r.status !== "completed" &&
              r.status !== "in_rental";

            const canMarkDisputed =
              r.status === "confirmed" ||
              r.status === "in_rental" ||
              r.status === "return_pending_confirmation";

            const handoverUploadOpen = openUploadKey === `${r.id}-handover`;
            const returnUploadOpen = openUploadKey === `${r.id}-return`;

            return (
              <li key={r.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-white/50">Rezervácia</span>
                      <strong className="text-base">#{r.id}</strong>
                    </div>

                    <div className="text-white/85">
                      <span className="text-white/50">Položka:</span>{" "}
                      <strong>{itemTitleMap[r.item_id] ?? `#${r.item_id}`}</strong>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-white/80">
                      <span className="text-white/50">Zákazník:</span>

                      <Link
                        href={`/profile/${r.renter_id}`}
                        className="underline underline-offset-2 hover:text-white"
                      >
                        {renterProfile?.full_name?.trim() || shortId(r.renter_id)}
                      </Link>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${verificationBadgeClass(
                          renterProfile?.verification_status || "unverified"
                        )}`}
                      >
                        {verificationLabel(renterProfile?.verification_status || "unverified")}
                      </span>

                      {renterProfile?.city ? (
                        <span className="text-sm text-white/50">· {renterProfile.city}</span>
                      ) : null}
                    </div>

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

                    <div className="text-sm text-white/60">
                      {r.status === "cancelled"
                        ? "Rezervácia je zrušená."
                        : r.status === "completed"
                        ? "Prenájom je ukončený."
                        : startIn > 0
                        ? `Začiatok prenájmu o ${startIn} ${startIn === 1 ? "deň" : startIn < 5 ? "dni" : "dní"}.`
                        : startIn === 0
                        ? "Prenájom začína dnes."
                        : "Termín už začal alebo prebieha."}
                    </div>
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

                <div className="mt-3 text-sm text-white/50">
                  Poskytovateľ platby: {r.payment_provider}
                </div>

                <div className="mt-4 space-y-4">
                  {r.status === "confirmed" ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="font-semibold">Krok 1: odovzdanie zákazníkovi</div>
                      <div className="mt-1 text-sm text-white/60">
                        Najprv nahraj fotky stavu veci pri odovzdaní. Až potom označ rezerváciu ako odovzdanú.
                      </div>

                      <div className="mt-3">
                        <div className="text-sm text-white/70">
                          Nahraté fotky pri odovzdaní: <strong>{handoverOwnerCount}</strong>
                        </div>
                        <div className="mt-3">{renderPhotoGrid(r.id, "handover", "owner")}</div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                          onClick={() => startUpload(r.id, "handover")}
                        >
                          Nahrať fotky pri odovzdaní
                        </button>

                        <button
                          className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                          onClick={() => updateReservationStatus(r.id, "in_rental")}
                          disabled={!canMarkHandedOver}
                          type="button"
                        >
                          Potvrdiť odovzdanie
                        </button>
                      </div>

                      {handoverOwnerCount === 0 ? (
                        <div className="mt-3 text-sm text-white/60">
                          Bez fotiek pri odovzdaní nejde pokračovať.
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {r.status === "return_pending_confirmation" ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="font-semibold">Krok 2: vrátenie od zákazníka</div>
                      <div className="mt-1 text-sm text-white/60">
                        Najprv si pozri fotky od zákazníka. Potom nahraj svoje fotky po vrátení a až nakoniec potvrď ukončenie prenájmu.
                      </div>

                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div>
                          <div className="text-sm font-medium text-white/80">Fotky od zákazníka po vrátení</div>
                          <div className="mt-1 text-sm text-white/60">
                            Nahraté zákazníkom: <strong>{returnRenterCount}</strong>
                          </div>
                          <div className="mt-3">{renderPhotoGrid(r.id, "return", "renter")}</div>
                        </div>

                        <div>
                          <div className="text-sm font-medium text-white/80">Tvoje fotky po vrátení</div>
                          <div className="mt-1 text-sm text-white/60">
                            Nahraté prenajímateľom: <strong>{returnOwnerCount}</strong>
                          </div>
                          <div className="mt-3">{renderPhotoGrid(r.id, "return", "owner")}</div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                          onClick={() => startUpload(r.id, "return")}
                        >
                          Nahrať fotky po vrátení
                        </button>

                        <button
                          className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                          onClick={() => updateReservationStatus(r.id, "completed")}
                          disabled={!canConfirmReturn}
                          type="button"
                        >
                          Potvrdiť vrátenie
                        </button>
                      </div>

                      {returnRenterCount === 0 ? (
                        <div className="mt-3 text-sm text-white/60">
                          Zákazník ešte nenahral svoje fotky po vrátení.
                        </div>
                      ) : null}

                      {returnOwnerCount === 0 ? (
                        <div className="mt-3 text-sm text-white/60">
                          Pred potvrdením vrátenia najprv nahraj svoje fotky po vrátení.
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {r.status === "in_rental" ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
                      Vec je označená ako odovzdaná. Teraz čakáš, kým zákazník nahrá fotky po vrátení a klikne <strong>Vrátil som</strong>.
                    </div>
                  ) : null}
                </div>

                {handoverUploadOpen || returnUploadOpen ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                    <div className="font-medium">
                      {handoverUploadOpen ? "Upload fotiek pri odovzdaní" : "Upload fotiek po vrátení"}
                    </div>

                    <input
                      id={`owner-upload-${r.id}-${handoverUploadOpen ? "handover" : "return"}`}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => setUploadFiles(Array.from(e.target.files ?? []))}
                    />

                    <label
                      htmlFor={`owner-upload-${r.id}-${handoverUploadOpen ? "handover" : "return"}`}
                      className={`inline-flex cursor-pointer rounded border border-white/15 px-4 py-2 hover:bg-white/10 ${
                        uploading ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      Vybrať súbory
                    </label>

                    <textarea
                      className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                      rows={3}
                      placeholder="Poznámka k stavu (voliteľné)"
                      value={uploadNote}
                      onChange={(e) => setUploadNote(e.target.value)}
                      disabled={uploading}
                    />

                    {uploadFiles.length > 0 ? (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                        <div className="font-medium text-white">Vybrané súbory:</div>
                        <div className="mt-1">{uploadFiles.map((f) => f.name).join(", ")}</div>
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
                        disabled={uploading}
                        onClick={() =>
                          uploadConditionPhotos(
                            r,
                            handoverUploadOpen ? "handover" : "return"
                          )
                        }
                      >
                        {uploading ? "Nahrávam..." : "Nahrať fotky"}
                      </button>

                      <button
                        type="button"
                        className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                        disabled={uploading}
                        onClick={() => {
                          setOpenUploadKey(null);
                          setUploadFiles([]);
                          setUploadNote("");
                        }}
                      >
                        Zrušiť
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-2">
                  {canConfirm ? (
                    <button
                      className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                      onClick={() => updateReservationStatus(r.id, "confirmed")}
                      type="button"
                    >
                      Potvrdiť rezerváciu
                    </button>
                  ) : null}

                  {canMarkDisputed ? (
                    <button
                      className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                      onClick={() => updateReservationStatus(r.id, "disputed")}
                      type="button"
                    >
                      Označiť spor
                    </button>
                  ) : null}

                  {canCancel ? (
                    <button
                      className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                      onClick={() => updateReservationStatus(r.id, "cancelled")}
                      type="button"
                    >
                      Zrušiť
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
                    href={`/items/${r.item_id}`}
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                  >
                    Detail ponuky
                  </Link>
                </div>

                {r.status === "disputed" ? (
                  <div className="mt-3 rounded-xl border border-purple-500/30 bg-purple-500/10 p-3 text-sm text-white/80">
                    Táto rezervácia je označená ako spor. Skontroluj reklamáciu a komunikáciu so zákazníkom.
                  </div>
                ) : null}

                {r.payment_status !== "paid" && r.status === "pending" ? (
                  <div className="mt-3 text-sm text-white/60">
                    Potvrdenie je dostupné až po úspešnej platbe.
                  </div>
                ) : null}

                {renderPaymentHistory(r.id)}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Rezervácie mojich ponúk</h1>
            <p className="mt-1 text-white/60">
              Prehľad objednávok zákazníkov a jasné kroky od odovzdania až po vrátenie.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/owner/items"
              className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
            >
              Moje ponuky
            </Link>
            <Link
              href="/owner/disputes"
              className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
            >
              Reklamácie
            </Link>
          </div>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard
          title="Čakajúce"
          value={pending.length}
          subtitle="Čakajú na schválenie"
        />
        <SummaryCard
          title="Potvrdené"
          value={confirmed.length}
          subtitle="Pripravené na odovzdanie"
        />
        <SummaryCard
          title="Prebieha prenájom"
          value={inRental.length}
          subtitle="Vec je u zákazníka"
        />
        <SummaryCard
          title="Čaká na vrátenie"
          value={returnPending.length}
          subtitle="Zákazník označil vrátenie"
        />
      </div>

      {renderSection(
        "Čakajúce rezervácie",
        "Nové rezervácie, ktoré ešte neboli potvrdené.",
        pending
      )}

      {renderSection(
        "Potvrdené rezervácie",
        "Rezervácie schválené a pripravené na odovzdanie.",
        confirmed
      )}

      {renderSection(
        "Prebiehajúce prenájmy",
        "Tieto rezervácie sú už odovzdané zákazníkovi.",
        inRental
      )}

      {renderSection(
        "Čaká na potvrdenie vrátenia",
        "Zákazník tvrdí, že vrátil. Treba skontrolovať fotky a potvrdiť ukončenie.",
        returnPending
      )}

      {renderSection(
        "Dokončené rezervácie",
        "Prenájom bol úspešne ukončený.",
        completed
      )}

      {renderSection(
        "Sporné rezervácie",
        "Rezervácie označené ako spor.",
        disputed
      )}

      {renderSection(
        "Zrušené rezervácie",
        "História zrušených rezervácií.",
        cancelled
      )}
    </main>
  );
}
