"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { insertNotification } from "@/lib/notifications";
import { supabase } from "@/lib/supabaseClient";

type ViewerKind = "renter" | "owner";

type ReservationRow = {
  id: number;
  item_id: number;
  renter_id: string;
  date_from: string;
  date_to: string;
  status: string;
  payment_status: string | null;
};

type ItemRow = {
  id: number;
  title: string;
  owner_id: string;
};

const ACTIVE_RESERVATION_STATUSES = new Set([
  "confirmed",
  "in_rental",
  "return_pending_confirmation",
  "disputed",
]);

const DISPUTE_TYPE_OPTIONS = [
  { value: "damage", label: "Poskodenie alebo skoda" },
  { value: "not_as_described", label: "Vec nezodpoveda popisu" },
  { value: "missing_accessories", label: "Chybajuce prislusenstvo" },
  { value: "handover_issue", label: "Problem pri odovzdani" },
  { value: "return_issue", label: "Problem pri vrateni" },
  { value: "other", label: "Ina reklamacia" },
];

function formatDate(dateStr: string) {
  const value = new Date(dateStr);
  if (Number.isNaN(value.getTime())) return dateStr;
  return value.toLocaleDateString("sk-SK");
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

function extractDisputeId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return extractDisputeId(record.id ?? record.dispute_id ?? record.p_dispute_id);
  }
  return null;
}

function getBackHref(viewer: ViewerKind) {
  return viewer === "owner" ? "/owner/disputes" : "/reservations";
}

function getListHref(viewer: ViewerKind) {
  return viewer === "owner" ? "/owner/disputes" : "/disputes";
}

function getDisputeTypeLabel(type: string) {
  if (type === "damage") return "Poskodenie alebo skoda";
  if (type === "not_as_described") return "Vec nezodpoveda popisu";
  if (type === "missing_accessories") return "Chybajuce prislusenstvo";
  if (type === "handover_issue") return "Problem pri odovzdani";
  if (type === "return_issue") return "Problem pri vrateni";
  if (type === "other") return "Ina reklamacia";
  return type.replaceAll("_", " ");
}

function NewDisputePageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const viewer: ViewerKind = pathname.startsWith("/owner/") ? "owner" : "renter";
  const reservationId = Number(searchParams.get("reservation_id") || "");

  const [statusText, setStatusText] = useState("Nacitavam...");
  const [saving, setSaving] = useState(false);

  const [reservation, setReservation] = useState<ReservationRow | null>(null);
  const [item, setItem] = useState<ItemRow | null>(null);

  const [disputeType, setDisputeType] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestedOutcome, setRequestedOutcome] = useState("");
  const [requestedAmount, setRequestedAmount] = useState("");
  const [depositAmountSnapshot, setDepositAmountSnapshot] = useState("");
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);

  const heading = viewer === "owner" ? "Nova reklamacia od prenajimatela" : "Nova reklamacia";
  const subtitle =
    viewer === "owner"
      ? "Pouzi pri realnom probleme so zverenou rezervaciou, odovzdanim alebo vratenim."
      : "Pouzi pri realnom probleme s prenajmom, odovzdanim alebo vratenim.";

  useEffect(() => {
    const load = async () => {
      setStatusText("Nacitavam...");

      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      if (!Number.isFinite(reservationId)) {
        setStatusText("Chyba rezervacia.");
        return;
      }

      const { data: reservationData, error: reservationError } = await supabase
        .from("reservations")
        .select("id,item_id,renter_id,date_from,date_to,status,payment_status")
        .eq("id", reservationId)
        .maybeSingle();

      if (reservationError) {
        setStatusText("Chyba: " + reservationError.message);
        return;
      }

      if (!reservationData) {
        setStatusText("Rezervacia neexistuje.");
        return;
      }

      const reservationRow = reservationData as ReservationRow;

      if (!ACTIVE_RESERVATION_STATUSES.has(reservationRow.status)) {
        setStatusText("Reklamaciu je mozne otvorit len pri aktivnej rezervacii.");
        return;
      }

      const { data: itemData, error: itemError } = await supabase
        .from("items")
        .select("id,title,owner_id")
        .eq("id", reservationRow.item_id)
        .maybeSingle();

      if (itemError) {
        setStatusText("Chyba: " + itemError.message);
        return;
      }

      if (!itemData) {
        setStatusText("Polozka neexistuje.");
        return;
      }

      const itemRow = itemData as ItemRow;

      if (viewer === "owner") {
        if (itemRow.owner_id !== userId) {
          setStatusText("Nemate pristup k tejto rezervacii.");
          return;
        }
      } else if (reservationRow.renter_id !== userId) {
        setStatusText("Nemate pristup k tejto rezervacii.");
        return;
      }

      setReservation(reservationRow);
      setItem(itemRow);
      setStatusText("");
    };

    void load();
  }, [reservationId, router, viewer]);

  const summaryLines = useMemo(() => {
    if (!reservation || !item) return [];
    return [
      `Rezervacia #${reservation.id}`,
      `Polozka: ${item.title}`,
      `Termin: ${formatDate(reservation.date_from)} -> ${formatDate(reservation.date_to)}`,
      `Stav rezervacie: ${reservation.status}`,
    ];
  }, [item, reservation]);

  const submitDispute = async () => {
    if (!reservation) return;

    const trimmedType = disputeType.trim();
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();

    if (!trimmedType) {
      setStatusText("Zadajte typ reklamacie.");
      alert("Zadajte typ reklamacie.");
      return;
    }

    if (!trimmedTitle) {
      setStatusText("Zadajte nazov reklamacie.");
      alert("Zadajte nazov reklamacie.");
      return;
    }

    if (!trimmedDescription) {
      setStatusText("Zadajte popis reklamacie.");
      alert("Zadajte popis reklamacie.");
      return;
    }

    setSaving(true);
    setStatusText("Ukladam reklamaciu...");

    try {
      const parsedRequestedAmount = parseOptionalAmount(requestedAmount, "Pozadovana suma");
      const parsedDepositAmountSnapshot = parseOptionalAmount(
        depositAmountSnapshot,
        "Snapshot depozitu"
      );
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase.rpc("dispute_open_v2", {
        p_reservation_id: reservation.id,
        p_dispute_type: trimmedType,
        p_title: trimmedTitle,
        p_description: trimmedDescription,
        p_dispute_requested_outcome: requestedOutcome.trim() || null,
        p_dispute_requested_amount: parsedRequestedAmount,
        p_deposit_amount_snapshot: parsedDepositAmountSnapshot,
      });

      if (error) throw new Error(error.message);

      const disputeId = extractDisputeId(data);

      if (evidenceFile) {
        if (!disputeId) {
          throw new Error("dispute_open_v2 nevratil dispute ID potrebne pre upload dokazov.");
        }

        const ext = (evidenceFile.name.split(".").pop() || "jpg").toLowerCase();
        const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
        const storagePath = `${disputeId}/${userId}/${crypto.randomUUID()}.${safeExt}`;

        const { error: uploadError } = await supabase.storage
          .from("dispute-evidence")
          .upload(storagePath, evidenceFile, {
            upsert: false,
            contentType: evidenceFile.type || "image/jpeg",
            cacheControl: "3600",
          });

        if (uploadError) throw new Error(uploadError.message);

        const { error: evidenceError } = await supabase.rpc("dispute_add_evidence", {
          p_dispute_id: disputeId,
          p_storage_path: storagePath,
          p_caption: null,
        });

        if (evidenceError) throw new Error(evidenceError.message);
      }

      if (disputeId) {
        const counterpartyUserId = viewer === "owner" ? reservation.renter_id : item?.owner_id;
        const counterpartyLink =
          viewer === "owner" ? `/disputes/${disputeId}` : `/owner/disputes/${disputeId}`;
        const notificationBodySource = trimmedTitle || getDisputeTypeLabel(trimmedType);

        if (counterpartyUserId) {
          await insertNotification({
            userId: counterpartyUserId,
            type: "dispute",
            title: `Nova reklamacia k rezervacii #${reservation.id}`,
            body: `${notificationBodySource} · caka na tvoju reakciu`,
            link: counterpartyLink,
          });
        }
      }

      router.push(disputeId ? `${getListHref(viewer)}/${disputeId}` : getListHref(viewer));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Neznama chyba pri ukladani reklamacie.";
      setStatusText("Chyba: " + message);
      alert(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{heading}</h1>
            <p className="mt-1 text-white/60">{subtitle}</p>
          </div>

          <Link
            href={getBackHref(viewer)}
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
          >
            Spat
          </Link>
        </div>
      </div>

      {statusText ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{statusText}</div>
      ) : null}

      {reservation && item ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_1.35fr]">
          <section className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">Rezervacia</div>

            {summaryLines.map((line) => (
              <div key={line} className="text-white/80">
                {line}
              </div>
            ))}
          </section>

          <section className="space-y-4 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="text-lg font-semibold">Detaily reklamacie</div>

            <label className="block">
              <div className="mb-1 text-white/80">Typ reklamacie</div>
              <select
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                value={disputeType}
                onChange={(event) => setDisputeType(event.target.value)}
                disabled={saving}
              >
                <option value="">Vyberte typ reklamacie</option>
                {DISPUTE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <div className="mb-1 text-white/80">Nazov</div>
              <input
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                disabled={saving}
                placeholder="Strucny nazov problemu"
              />
            </label>

            <label className="block">
              <div className="mb-1 text-white/80">Popis</div>
              <textarea
                className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                rows={8}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={saving}
                placeholder="Vecne popiste, co sa stalo a preco otvarate reklamaciu."
              />
            </label>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="block md:col-span-1">
                <div className="mb-1 text-white/80">Pozadovany vysledok</div>
                <input
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={requestedOutcome}
                  onChange={(event) => setRequestedOutcome(event.target.value)}
                  disabled={saving}
                  placeholder="napr. refund, deposit_withheld"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-white/80">Pozadovana suma</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={requestedAmount}
                  onChange={(event) => setRequestedAmount(event.target.value)}
                  disabled={saving}
                  placeholder="0.00"
                />
              </label>

              <label className="block">
                <div className="mb-1 text-white/80">Snapshot depozitu (volitelne)</div>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded border border-white/20 bg-white px-3 py-2 text-black"
                  value={depositAmountSnapshot}
                  onChange={(event) => setDepositAmountSnapshot(event.target.value)}
                  disabled={saving}
                  placeholder="0.00"
                />
              </label>
            </div>

            <label className="block">
              <div className="mb-1 text-white/80">Dokazova fotka (volitelne)</div>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-white/80"
                disabled={saving}
                onChange={(event) => setEvidenceFile(event.target.files?.[0] ?? null)}
              />
            </label>

            {evidenceFile ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/70">
                Vybrany subor: <strong className="text-white">{evidenceFile.name}</strong>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:opacity-50"
                onClick={submitDispute}
                disabled={saving}
              >
                {saving ? "Ukladam..." : "Otvorit reklamaciu"}
              </button>

              <Link
                href={getBackHref(viewer)}
                className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
              >
                Zrusit
              </Link>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

export default function NewDisputePage() {
  return (
    <Suspense
      fallback={
        <main className="space-y-6">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">Nacitavam...</div>
        </main>
      }
    >
      <NewDisputePageInner />
    </Suspense>
  );
}
