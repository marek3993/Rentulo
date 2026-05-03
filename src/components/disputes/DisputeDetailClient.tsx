"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { insertNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";

type ViewerKind = "renter" | "owner" | "admin";
type RawRecord = Record<string, unknown>;

type DisputeRow = {
  id: number;
  reservationId: number | null;
  itemId: number | null;
  renterId: string | null;
  ownerId: string | null;
  status: string;
  disputeType: string | null;
  title: string | null;
  description: string | null;
  reason: string | null;
  details: string | null;
  resolutionNote: string | null;
  reservationStatusAfterDispute: string | null;
  rentalAmountSnapshot: number | null;
  depositAmountSnapshot: number | null;
  disputeRequestedOutcome: string | null;
  disputeRequestedAmount: number | null;
  disputeDecisionOutcome: string | null;
  disputeDecisionAmount: number | null;
  refundExecutionStatus: string | null;
  depositExecutionStatus: string | null;
  refundPaymentEventId: number | null;
  depositPaymentEventId: number | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type ReservationRow = {
  id: number;
  date_from: string;
  date_to: string;
  status: string;
  payment_status: string | null;
  rental_amount_snapshot: number | null;
  deposit_amount_snapshot: number | null;
};

type ItemRow = {
  id: number;
  title: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
  role: string | null;
};

type MessageRow = {
  id: string;
  body: string;
  authorId: string | null;
  createdAt: string | null;
};

type EvidenceRow = {
  id: string;
  storagePath: string;
  caption: string | null;
  uploadedBy: string | null;
  createdAt: string | null;
  url: string | null;
};

type Props = {
  disputeId: number;
  viewer: ViewerKind;
};

const RESERVATION_STATUS_OPTIONS = [
  "confirmed",
  "in_rental",
  "return_pending_confirmation",
  "completed",
  "cancelled",
  "disputed",
];

const STATUS_SUGGESTIONS = ["open", "under_review", "resolved", "rejected", "closed"];

function getDisputeTypeLabel(type: string) {
  if (type === "damage") return "Poskodenie alebo skoda";
  if (type === "not_as_described") return "Vec nezodpoveda popisu";
  if (type === "missing_accessories") return "Chybajuce prislusenstvo";
  if (type === "handover_issue") return "Problem pri odovzdani";
  if (type === "return_issue") return "Problem pri vrateni";
  if (type === "other") return "Ina reklamacia";
  return type.replaceAll("_", " ");
}

function getReservationStatusLabel(status: string) {
  if (status === "confirmed") return "Potvrdena";
  if (status === "in_rental") return "Prebieha prenajom";
  if (status === "return_pending_confirmation") return "Caka na potvrdenie vratenia";
  if (status === "completed") return "Dokoncena";
  if (status === "cancelled") return "Zrusena";
  if (status === "disputed") return "V reklamacii";
  return status.replaceAll("_", " ");
}

function getPaymentStatusLabel(status: string | null) {
  if (status === "paid") return "Uhradene";
  if (status === "failed") return "Platba zlyhala";
  if (status === "unpaid") return "Neuhradene";
  return status ?? "-";
}

function readString(record: RawRecord | null | undefined, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed ? trimmed : null;
    }
  }

  return null;
}

function readNumber(record: RawRecord | null | undefined, keys: string[]) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("sk-SK");
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("sk-SK");
}

function formatCurrencyAmount(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function getRentalSnapshotAmount(dispute: DisputeRow | null, reservation: ReservationRow | null) {
  return dispute?.rentalAmountSnapshot ?? reservation?.rental_amount_snapshot ?? null;
}

function getDepositSnapshotAmount(dispute: DisputeRow | null, reservation: ReservationRow | null) {
  return dispute?.depositAmountSnapshot ?? reservation?.deposit_amount_snapshot ?? 0;
}

function formatOptionalText(value: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function parseOptionalAmount(value: string, fieldLabel: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} musi byt nezaporne cislo.`);
  }

  return parsed;
}

function humanizeStatus(status: string) {
  if (status === "open") return "Otvorena";
  if (status === "under_review") return "V rieseni";
  if (status === "resolved") return "Vyriesena";
  if (status === "rejected") return "Zamietnuta";
  if (status === "closed") return "Uzatvorena";
  return status.replaceAll("_", " ");
}

function disputeBadgeClass(status: string) {
  if (status === "open") return "bg-red-600/90 text-white";
  if (status === "under_review") return "bg-yellow-400 text-black";
  if (status === "resolved") return "bg-emerald-600/90 text-white";
  if (status === "rejected") return "bg-slate-500/90 text-white";
  if (status === "closed") return "bg-white/10 text-white";
  return "bg-blue-600/90 text-white";
}

function needsReservationStatus(status: string) {
  return status === "resolved" || status === "rejected" || status === "closed";
}

function normalizeDispute(record: RawRecord): DisputeRow {
  return {
    id: readNumber(record, ["id"]) ?? 0,
    reservationId: readNumber(record, ["reservation_id"]),
    itemId: readNumber(record, ["item_id"]),
    renterId: readString(record, ["renter_id"]),
    ownerId: readString(record, ["owner_id"]),
    status: readString(record, ["status"]) ?? "unknown",
    disputeType: readString(record, ["dispute_type"]),
    title: readString(record, ["title"]),
    description: readString(record, ["description"]),
    reason: readString(record, ["reason"]),
    details: readString(record, ["details"]),
    resolutionNote: readString(record, ["resolution_note"]),
    reservationStatusAfterDispute: readString(record, ["reservation_status_after_dispute"]),
    rentalAmountSnapshot: readNumber(record, ["rental_amount_snapshot"]),
    depositAmountSnapshot: readNumber(record, ["deposit_amount_snapshot"]),
    disputeRequestedOutcome: readString(record, ["dispute_requested_outcome"]),
    disputeRequestedAmount: readNumber(record, ["dispute_requested_amount"]),
    disputeDecisionOutcome: readString(record, ["dispute_decision_outcome"]),
    disputeDecisionAmount: readNumber(record, ["dispute_decision_amount"]),
    refundExecutionStatus: readString(record, ["refund_execution_status"]),
    depositExecutionStatus: readString(record, ["deposit_execution_status"]),
    refundPaymentEventId: readNumber(record, ["refund_payment_event_id"]),
    depositPaymentEventId: readNumber(record, ["deposit_payment_event_id"]),
    createdAt: readString(record, ["created_at"]),
    updatedAt: readString(record, ["updated_at"]),
  };
}

function normalizeMessage(record: RawRecord): MessageRow {
  return {
    id: String(readNumber(record, ["id"]) ?? crypto.randomUUID()),
    body: readString(record, ["body", "message"]) ?? "",
    authorId: readString(record, ["author_id", "sender_id", "user_id", "created_by"]),
    createdAt: readString(record, ["created_at", "inserted_at"]),
  };
}

function normalizeEvidence(record: RawRecord): EvidenceRow {
  return {
    id: String(readNumber(record, ["id"]) ?? crypto.randomUUID()),
    storagePath: readString(record, ["storage_path", "path", "file_path"]) ?? "",
    caption: readString(record, ["caption", "note"]),
    uploadedBy: readString(record, ["uploaded_by", "user_id", "author_id", "created_by"]),
    createdAt: readString(record, ["created_at", "inserted_at"]),
    url: null,
  };
}

function getBackHref(viewer: ViewerKind) {
  if (viewer === "owner") return "/owner/disputes";
  if (viewer === "admin") return "/admin/disputes";
  return "/disputes";
}

function getViewerTitle(viewer: ViewerKind) {
  if (viewer === "owner") return "Detail reklamacie pre prenajimatela";
  if (viewer === "admin") return "Admin detail reklamacie";
  return "Detail reklamacie";
}

function getDisputeLinkForUser(disputeId: number, userKind: "renter" | "owner") {
  return userKind === "owner" ? `/owner/disputes/${disputeId}` : `/disputes/${disputeId}`;
}

export default function DisputeDetailClient({ disputeId, viewer }: Props) {
  const router = useRouter();

  const [statusText, setStatusText] = useState("Nacitavam...");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [dispute, setDispute] = useState<DisputeRow | null>(null);
  const [reservation, setReservation] = useState<ReservationRow | null>(null);
  const [item, setItem] = useState<ItemRow | null>(null);
  const [renter, setRenter] = useState<ProfileRow | null>(null);
  const [owner, setOwner] = useState<ProfileRow | null>(null);
  const [messageAuthorMap, setMessageAuthorMap] = useState<Record<string, ProfileRow>>({});
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [evidence, setEvidence] = useState<EvidenceRow[]>([]);

  const [replyBody, setReplyBody] = useState("");
  const [replySaving, setReplySaving] = useState(false);

  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceCaption, setEvidenceCaption] = useState("");
  const [evidenceSaving, setEvidenceSaving] = useState(false);

  const [nextStatus, setNextStatus] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [reservationStatusAfter, setReservationStatusAfter] = useState("");
  const [decisionOutcome, setDecisionOutcome] = useState("");
  const [decisionAmount, setDecisionAmount] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [executeRefund, setExecuteRefund] = useState(false);
  const [executeDeposit, setExecuteDeposit] = useState(false);
  const [executionNote, setExecutionNote] = useState("");
  const [executionSaving, setExecutionSaving] = useState(false);

  const isAdminViewer = viewer === "admin";

  const statusSuggestions = useMemo(() => {
    const unique = new Set(STATUS_SUGGESTIONS);
    if (dispute?.status) unique.add(dispute.status);
    return Array.from(unique);
  }, [dispute?.status]);

  const title = dispute?.title || dispute?.reason || `Reklamacia #${dispute?.id ?? disputeId}`;
  const description = dispute?.description || dispute?.details || "";

  const loadDispute = async () => {
    if (!Number.isFinite(disputeId)) {
      setStatusText("Neplatne ID reklamacie.");
      return;
    }

    setStatusText("Nacitavam...");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    setCurrentUserId(userId);

    if (viewer === "admin") {
      const { data: meData, error: meError } = await supabase
        .from("profiles")
        .select("id,full_name,city,role")
        .eq("id", userId)
        .maybeSingle();

      if (meError) {
        setStatusText("Chyba: " + meError.message);
        return;
      }

      const me = (meData ?? null) as ProfileRow | null;
      if (!me || me.role !== "admin") {
        router.replace("/");
        return;
      }
    }

    const { data: disputeData, error: disputeError } = await supabase
      .from("disputes")
      .select(
        "id,reservation_id,item_id,renter_id,owner_id,status,dispute_type,title,description,reason,details,resolution_note,reservation_status_after_dispute,rental_amount_snapshot,deposit_amount_snapshot,dispute_requested_outcome,dispute_requested_amount,dispute_decision_outcome,dispute_decision_amount,refund_execution_status,deposit_execution_status,refund_payment_event_id,deposit_payment_event_id,created_at,updated_at"
      )
      .eq("id", disputeId)
      .maybeSingle();

    if (disputeError) {
      setStatusText("Chyba: " + disputeError.message);
      return;
    }

    if (!disputeData) {
      setStatusText("Reklamacia neexistuje.");
      return;
    }

    const disputeRow = normalizeDispute(disputeData as RawRecord);

    if (viewer === "renter" && disputeRow.renterId !== userId) {
      setStatusText("Nemate pristup k tejto reklamacii.");
      return;
    }

    if (viewer === "owner" && disputeRow.ownerId !== userId) {
      setStatusText("Nemate pristup k tejto reklamacii.");
      return;
    }

    const [reservationResult, itemResult, renterResult, ownerResult, messagesResult, evidenceResult] =
      await Promise.all([
        disputeRow.reservationId
          ? supabase
              .from("reservations")
              .select("id,date_from,date_to,status,payment_status,rental_amount_snapshot,deposit_amount_snapshot")
              .eq("id", disputeRow.reservationId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        disputeRow.itemId
          ? supabase.from("items").select("id,title").eq("id", disputeRow.itemId).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        disputeRow.renterId
          ? supabase
              .from("profiles")
              .select("id,full_name,city,role")
              .eq("id", disputeRow.renterId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        disputeRow.ownerId
          ? supabase
              .from("profiles")
              .select("id,full_name,city,role")
              .eq("id", disputeRow.ownerId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase.from("dispute_messages").select("*").eq("dispute_id", disputeId).order("created_at", { ascending: true }),
        supabase.from("dispute_evidence").select("*").eq("dispute_id", disputeId).order("created_at", { ascending: false }),
      ]);

    const firstError =
      reservationResult.error ||
      itemResult.error ||
      renterResult.error ||
      ownerResult.error ||
      messagesResult.error ||
      evidenceResult.error;

    if (firstError) {
      setStatusText("Chyba: " + firstError.message);
      return;
    }

    const messageRows = ((messagesResult.data ?? []) as RawRecord[]).map(normalizeMessage);
    const evidenceRows = ((evidenceResult.data ?? []) as RawRecord[]).map(normalizeEvidence);

    const profileIds = Array.from(
      new Set(
        [
          ...messageRows.map((row) => row.authorId),
          disputeRow.renterId,
          disputeRow.ownerId,
        ].filter((value): value is string => !!value)
      )
    );

    const { data: profileRows } =
      profileIds.length > 0
        ? await supabase.from("profiles").select("id,full_name,city,role").in("id", profileIds)
        : { data: [] as ProfileRow[] };

    const nextAuthorMap: Record<string, ProfileRow> = {};
    for (const profile of (profileRows ?? []) as ProfileRow[]) {
      nextAuthorMap[profile.id] = profile;
    }

    const evidencePaths = evidenceRows
      .map((row) => row.storagePath)
      .filter((value): value is string => value.length > 0);

    const signedUrlMap = new Map<string, string | null>();

    if (evidencePaths.length > 0) {
      const { data: signedUrls } = await supabase.storage
        .from("dispute-evidence")
        .createSignedUrls(evidencePaths, 60 * 60);

      for (const row of signedUrls ?? []) {
        if (row.path) {
          signedUrlMap.set(row.path, row.signedUrl ?? null);
        }
      }
    }

    setDispute(disputeRow);
    setReservation((reservationResult.data ?? null) as ReservationRow | null);
    setItem((itemResult.data ?? null) as ItemRow | null);
    setRenter((renterResult.data ?? null) as ProfileRow | null);
    setOwner((ownerResult.data ?? null) as ProfileRow | null);
    setMessages(messageRows);
    setMessageAuthorMap(nextAuthorMap);
    setEvidence(
      evidenceRows.map((row) => ({
        ...row,
        url: signedUrlMap.get(row.storagePath) ?? null,
      }))
    );
    setNextStatus(disputeRow.status);
    setResolutionNote(disputeRow.resolutionNote ?? "");
    setReservationStatusAfter(disputeRow.reservationStatusAfterDispute ?? "");
    setDecisionOutcome(disputeRow.disputeDecisionOutcome ?? "");
    setDecisionAmount(
      disputeRow.disputeDecisionAmount === null ? "" : String(disputeRow.disputeDecisionAmount)
    );
    setExecuteRefund(false);
    setExecuteDeposit(false);
    setExecutionNote("");
    setStatusText("");
  };

  useEffect(() => {
    void loadDispute();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disputeId, viewer]);

  const submitReply = async () => {
    const trimmedBody = replyBody.trim();

    if (!trimmedBody) {
      setStatusText("Napiste odpoved.");
      alert("Napiste odpoved.");
      return;
    }

    setReplySaving(true);
    setStatusText("Ukladam odpoved...");

    const { error } = await supabase.rpc("dispute_add_reply", {
      p_dispute_id: disputeId,
      p_body: trimmedBody,
    });

    if (error) {
      setReplySaving(false);
      setStatusText("Chyba: " + error.message);
      alert(error.message);
      return;
    }

    const replyRecipientId =
      currentUserId && currentUserId === dispute?.renterId ? dispute.ownerId : currentUserId === dispute?.ownerId ? dispute.renterId : null;
    const replyRecipientKind =
      currentUserId && currentUserId === dispute?.renterId ? "owner" : currentUserId === dispute?.ownerId ? "renter" : null;

    if (replyRecipientId && replyRecipientKind) {
      await insertNotification({
        userId: replyRecipientId,
        type: "dispute",
        title: `Nova sprava k reklamacii #${disputeId}`,
        body: "Druha strana pridala vyjadrenie.",
        link: getDisputeLinkForUser(disputeId, replyRecipientKind),
      });
    }

    setReplyBody("");
    setReplySaving(false);
    await loadDispute();
  };

  const submitEvidence = async () => {
    if (!evidenceFile || !currentUserId) {
      setStatusText("Vyberte obrazok.");
      alert("Vyberte obrazok.");
      return;
    }

    setEvidenceSaving(true);
    setStatusText("Nahravam dokaz...");

    try {
      const ext = (evidenceFile.name.split(".").pop() || "jpg").toLowerCase();
      const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
      const storagePath = `${disputeId}/${currentUserId}/${crypto.randomUUID()}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from("dispute-evidence")
        .upload(storagePath, evidenceFile, {
          upsert: false,
          contentType: evidenceFile.type || "image/jpeg",
          cacheControl: "3600",
        });

      if (uploadError) throw new Error(uploadError.message);

      const { error: rpcError } = await supabase.rpc("dispute_add_evidence", {
        p_dispute_id: disputeId,
        p_storage_path: storagePath,
        p_caption: evidenceCaption.trim() || null,
      });

      if (rpcError) throw new Error(rpcError.message);

      setEvidenceFile(null);
      setEvidenceCaption("");
      await loadDispute();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Neznama chyba pri uploade dokazu.";
      setStatusText("Chyba: " + message);
      alert(message);
    } finally {
      setEvidenceSaving(false);
    }
  };

  const submitStatusUpdate = async () => {
    const trimmedStatus = nextStatus.trim();
    const trimmedResolutionNote = resolutionNote.trim();
    const trimmedReservationStatus = reservationStatusAfter.trim();
    const trimmedDecisionOutcome = decisionOutcome.trim();

    if (!trimmedStatus) {
      setStatusText("Zadajte dalsi stav reklamacie.");
      alert("Zadajte dalsi stav reklamacie.");
      return;
    }

    if (needsReservationStatus(trimmedStatus) && !trimmedReservationStatus) {
      setStatusText("Vyberte stav rezervacie po reklamacii.");
      alert("Vyberte stav rezervacie po reklamacii.");
      return;
    }

    let parsedDecisionAmount: number | null;
    try {
      parsedDecisionAmount = parseOptionalAmount(decisionAmount, "Rozhodnuta suma");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Rozhodnuta suma musi byt nezaporne cislo.";
      setStatusText("Chyba: " + message);
      alert(message);
      return;
    }

    setStatusSaving(true);
    setStatusText("Ukladam stav reklamacie...");

    const { error } = await supabase.rpc("dispute_set_status_v2", {
      p_dispute_id: disputeId,
      p_next_status: trimmedStatus,
      p_resolution_note: trimmedResolutionNote || null,
      p_reservation_status_after_dispute: needsReservationStatus(trimmedStatus)
        ? trimmedReservationStatus
        : null,
      p_dispute_decision_outcome: trimmedDecisionOutcome || null,
      p_dispute_decision_amount: parsedDecisionAmount,
    });

    if (error) {
      setStatusSaving(false);
      setStatusText("Chyba: " + error.message);
      alert(error.message);
      return;
    }

    const notificationTargets = [
      dispute?.renterId
        ? {
            userId: dispute.renterId,
            link: getDisputeLinkForUser(disputeId, "renter"),
          }
        : null,
      dispute?.ownerId
        ? {
            userId: dispute.ownerId,
            link: getDisputeLinkForUser(disputeId, "owner"),
          }
        : null,
    ].filter((target): target is { userId: string; link: string } => !!target);

    await Promise.all(
      notificationTargets.map((target) =>
        insertNotification({
          userId: target.userId,
          type: "dispute",
          title: `Aktualizacia reklamacie #${disputeId}`,
          body: `Stav reklamacie bol zmeneny na: ${trimmedStatus}`,
          link: target.link,
        })
      )
    );

    setStatusSaving(false);
    await loadDispute();
  };

  const submitFinancialExecution = async () => {
    if (!executeRefund && !executeDeposit) {
      setStatusText("Vyberte refund alebo depozit na vykonanie.");
      alert("Vyberte refund alebo depozit na vykonanie.");
      return;
    }

    setExecutionSaving(true);
    setStatusText("Vykonavam financny vysledok...");

    const { error } = await supabase.rpc("dispute_execute_financial_outcome_v1", {
      p_dispute_id: disputeId,
      p_execute_refund: executeRefund,
      p_execute_deposit: executeDeposit,
      p_note: executionNote.trim() || null,
    });

    if (error) {
      setExecutionSaving(false);
      setStatusText("Chyba: " + error.message);
      alert(error.message);
      return;
    }

    setExecutionSaving(false);
    await loadDispute();
  };

  return (
    <main className="space-y-6">
      <Link
        href={getBackHref(viewer)}
        className="inline-flex rounded border border-white/15 px-3 py-2 hover:bg-white/10"
      >
        Spat na reklamacie
      </Link>

      {statusText ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{statusText}</div>
      ) : null}

      {dispute ? (
        <>
          <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="text-sm uppercase tracking-wide text-white/50">{getViewerTitle(viewer)}</div>
                <h1 className="text-2xl font-semibold">{title}</h1>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-1 text-sm font-medium ${disputeBadgeClass(dispute.status)}`}>
                    {humanizeStatus(dispute.status)}
                  </span>
                  <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-white/80">
                    ID #{dispute.id}
                  </span>
                  {dispute.disputeType ? (
                    <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-white/80">
                      Typ: {getDisputeTypeLabel(dispute.disputeType)}
                    </span>
                  ) : null}
                </div>
                {description ? (
                  <p className="max-w-4xl whitespace-pre-wrap text-white/80">{description}</p>
                ) : null}
              </div>

              <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
                <div>Vytvorene: {formatDateTime(dispute.createdAt)}</div>
                <div>Aktualizovane: {formatDateTime(dispute.updatedAt)}</div>
                <div>Rezervacia: {dispute.reservationId ? `#${dispute.reservationId}` : "-"}</div>
                <div>Polozka: {item?.title ?? (dispute.itemId ? `#${dispute.itemId}` : "-")}</div>
              </div>
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1.05fr_1.35fr]">
            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-lg font-semibold">Kto je v reklamacii</div>
                <div className="mt-4 space-y-4 text-white/80">
                  <div>
                    <div className="text-sm text-white/50">Najomca</div>
                    <div className="font-medium">{renter?.full_name || dispute.renterId || "-"}</div>
                    <div className="text-sm text-white/60">{renter?.city || "-"}</div>
                  </div>
                  <div>
                    <div className="text-sm text-white/50">Prenajimatel</div>
                    <div className="font-medium">{owner?.full_name || dispute.ownerId || "-"}</div>
                    <div className="text-sm text-white/60">{owner?.city || "-"}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-lg font-semibold">Rezervacia</div>
                {reservation ? (
                  <div className="mt-4 space-y-2 text-white/80">
                    <div>Termin: {formatDate(reservation.date_from)} {" -> "} {formatDate(reservation.date_to)}</div>
                    <div>Stav rezervacie: {getReservationStatusLabel(reservation.status)}</div>
                    <div>Stav platby: {getPaymentStatusLabel(reservation.payment_status)}</div>
                  </div>
                ) : (
                  <div className="mt-4 text-white/60">Udaje o rezervacii nie su dostupne.</div>
                )}

                {dispute.resolutionNote ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
                    <div className="text-sm font-medium text-white">Poznamka k rozhodnutiu</div>
                    <div className="mt-2 whitespace-pre-wrap text-sm text-white/70">{dispute.resolutionNote}</div>
                  </div>
                ) : null}

                {dispute.reservationStatusAfterDispute ? (
                  <div className="mt-4 text-sm text-white/70">
                    Vysledny stav rezervacie:{" "}
                    <strong className="text-white">
                      {getReservationStatusLabel(dispute.reservationStatusAfterDispute)}
                    </strong>
                  </div>
                ) : null}
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-lg font-semibold">Financne zhrnutie</div>
                <div className="mt-4 grid gap-3 text-sm text-white/75 sm:grid-cols-2">
                  <div>
                    <div className="text-white/45">Snapshot prenajmu</div>
                    <div className="mt-1 text-white">
                      {formatCurrencyAmount(getRentalSnapshotAmount(dispute, reservation))}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/45">Snapshot depozitu</div>
                    <div className="mt-1 text-white">
                      {formatCurrencyAmount(getDepositSnapshotAmount(dispute, reservation))}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/45">Pozadovany vysledok</div>
                    <div className="mt-1 text-white">{formatOptionalText(dispute.disputeRequestedOutcome)}</div>
                  </div>
                  <div>
                    <div className="text-white/45">Pozadovana suma</div>
                    <div className="mt-1 text-white">{formatCurrencyAmount(dispute.disputeRequestedAmount)}</div>
                  </div>
                  <div>
                    <div className="text-white/45">Rozhodnuty vysledok</div>
                    <div className="mt-1 text-white">{formatOptionalText(dispute.disputeDecisionOutcome)}</div>
                  </div>
                  <div>
                    <div className="text-white/45">Rozhodnuta suma</div>
                    <div className="mt-1 text-white">{formatCurrencyAmount(dispute.disputeDecisionAmount)}</div>
                  </div>
                  <div>
                    <div className="text-white/45">Refund vykonanie</div>
                    <div className="mt-1 text-white">
                      {formatOptionalText(dispute.refundExecutionStatus)}
                      {dispute.refundPaymentEventId !== null ? ` · event #${dispute.refundPaymentEventId}` : ""}
                    </div>
                  </div>
                  <div>
                    <div className="text-white/45">Depozit vykonanie</div>
                    <div className="mt-1 text-white">
                      {formatOptionalText(dispute.depositExecutionStatus)}
                      {dispute.depositPaymentEventId !== null ? ` · event #${dispute.depositPaymentEventId}` : ""}
                    </div>
                  </div>
                </div>
              </div>

              {isAdminViewer ? (
                <div className="space-y-6">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="text-lg font-semibold">Zmena stavu reklamacie</div>

                    <div className="mt-4 space-y-4">
                      <label className="block">
                        <div className="mb-1 text-white/80">Dalsi stav reklamacie</div>
                        <input
                          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                          list="dispute-status-suggestions"
                          value={nextStatus}
                          onChange={(event) => setNextStatus(event.target.value)}
                          disabled={statusSaving}
                        />
                        <datalist id="dispute-status-suggestions">
                          {statusSuggestions.map((status) => (
                            <option key={status} value={status} />
                          ))}
                        </datalist>
                      </label>

                      <div className="grid gap-4 md:grid-cols-2">
                        <label className="block">
                          <div className="mb-1 text-white/80">Rozhodnuty vysledok</div>
                          <input
                            className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                            value={decisionOutcome}
                            onChange={(event) => setDecisionOutcome(event.target.value)}
                            disabled={statusSaving}
                            placeholder="napr. rental_refund_issued, deposit_withheld"
                          />
                        </label>

                        <label className="block">
                          <div className="mb-1 text-white/80">Rozhodnuta suma</div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                            value={decisionAmount}
                            onChange={(event) => setDecisionAmount(event.target.value)}
                            disabled={statusSaving}
                            placeholder="0.00"
                          />
                        </label>
                      </div>

                      <label className="block">
                        <div className="mb-1 text-white/80">Poznamka k rozhodnutiu</div>
                        <textarea
                          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                          rows={4}
                          value={resolutionNote}
                          onChange={(event) => setResolutionNote(event.target.value)}
                          disabled={statusSaving}
                          placeholder="Volitelna poznamka k rozhodnutiu o reklamacii"
                        />
                      </label>

                      {needsReservationStatus(nextStatus.trim()) ? (
                        <label className="block">
                          <div className="mb-1 text-white/80">Vysledny stav rezervacie</div>
                          <select
                            className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                            value={reservationStatusAfter}
                            onChange={(event) => setReservationStatusAfter(event.target.value)}
                            disabled={statusSaving}
                          >
                            <option value="">Vyberte stav rezervacie</option>
                            {RESERVATION_STATUS_OPTIONS.map((option) => (
                              <option key={option} value={option}>
                                {getReservationStatusLabel(option)}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : null}

                      <button
                        type="button"
                        className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                        onClick={submitStatusUpdate}
                        disabled={statusSaving}
                      >
                        {statusSaving ? "Ukladam..." : "Ulozit stav"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                    <div className="text-lg font-semibold">Manualne vykonanie financneho vysledku</div>

                    <div className="mt-4 space-y-4">
                      <label className="flex items-center gap-3 text-white/80">
                        <input
                          type="checkbox"
                          checked={executeRefund}
                          onChange={(event) => setExecuteRefund(event.target.checked)}
                          disabled={executionSaving}
                        />
                        <span>Vykonat refund</span>
                      </label>

                      <label className="flex items-center gap-3 text-white/80">
                        <input
                          type="checkbox"
                          checked={executeDeposit}
                          onChange={(event) => setExecuteDeposit(event.target.checked)}
                          disabled={executionSaving}
                        />
                        <span>Vykonat depozit</span>
                      </label>

                      <label className="block">
                        <div className="mb-1 text-white/80">Poznamka k vykonaniu</div>
                        <textarea
                          className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                          rows={3}
                          value={executionNote}
                          onChange={(event) => setExecutionNote(event.target.value)}
                          disabled={executionSaving}
                          placeholder="Volitelna admin poznamka"
                        />
                      </label>

                      <button
                        type="button"
                        className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                        onClick={submitFinancialExecution}
                        disabled={executionSaving}
                      >
                        {executionSaving ? "Vykonavam..." : "Vykonat financny vysledok"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-6">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-lg font-semibold">Spravy v reklamacii</div>
                <div className="mt-4 space-y-3">
                  {messages.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
                      Zatial bez odpovedi.
                    </div>
                  ) : (
                    messages.map((message) => {
                      const author = message.authorId ? messageAuthorMap[message.authorId] : null;
                      const isMine = !!currentUserId && message.authorId === currentUserId;

                      return (
                        <div
                          key={message.id}
                          className={`rounded-2xl border p-4 ${
                            isMine ? "border-white/15 bg-white text-black" : "border-white/10 bg-black/20 text-white"
                          }`}
                        >
                          <div className={`text-xs ${isMine ? "text-black/60" : "text-white/50"}`}>
                            {author?.full_name || message.authorId || "Neznamy autor"} · {formatDateTime(message.createdAt)}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap">{message.body}</div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <div className="font-medium">Pridat odpoved</div>
                  <textarea
                    className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                    rows={4}
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    disabled={replySaving}
                    placeholder="Napiste odpoved do reklamacie"
                  />
                  <button
                    type="button"
                    className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                    onClick={submitReply}
                    disabled={replySaving}
                  >
                    {replySaving ? "Ukladam..." : "Pridat odpoved"}
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="text-lg font-semibold">Dokazy</div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {evidence.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/60 md:col-span-2">
                      Zatial bez nahratych dokazov.
                    </div>
                  ) : (
                    evidence.map((row) => {
                      const uploader = row.uploadedBy ? messageAuthorMap[row.uploadedBy] : null;

                      return (
                        <div key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          {row.url ? (
                            <img
                              src={row.url}
                              alt={row.caption || "Dokaz k reklamacii"}
                              className="h-48 w-full rounded-xl object-cover"
                            />
                          ) : (
                            <div className="flex h-48 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm text-white/40">
                              Bez preview
                            </div>
                          )}

                          <div className="mt-3 text-sm text-white/70">
                            <div>{row.caption || "Bez popisu"}</div>
                            <div className="mt-1 text-white/50">
                              {uploader?.full_name || row.uploadedBy || "Neznamy autor"} · {formatDateTime(row.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="mt-6 space-y-3">
                  <div className="font-medium">Pridat dokaz</div>
                  <input
                    type="file"
                    accept="image/*"
                    className="block w-full text-sm text-white/80"
                    disabled={evidenceSaving}
                    onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
                  />
                  <textarea
                    className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                    rows={3}
                    value={evidenceCaption}
                    onChange={(event) => setEvidenceCaption(event.target.value)}
                    disabled={evidenceSaving}
                    placeholder="Volitelny popis dokazu"
                  />
                  <button
                    type="button"
                    className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                    onClick={submitEvidence}
                    disabled={evidenceSaving}
                  >
                    {evidenceSaving ? "Nahravam..." : "Pridat dokaz"}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

