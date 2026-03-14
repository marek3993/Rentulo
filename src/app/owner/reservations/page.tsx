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
  renter_id: string;
};

type ItemRow = {
  id: number;
  title: string;
  owner_id: string;
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

export default function OwnerReservationsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Načítavam...");
  const [itemTitleMap, setItemTitleMap] = useState<Record<number, string>>({});

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
      setStatus("");
      return;
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_provider,renter_id")
      .in("item_id", itemIds)
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setRows((data ?? []) as Row[]);
    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateReservationStatus = async (
    id: number,
    nextStatus:
      | "confirmed"
      | "in_rental"
      | "return_pending_confirmation"
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

  const Section = ({
    title,
    subtitle,
    rows,
  }: {
    title: string;
    subtitle: string;
    rows: Row[];
  }) => (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="mt-1 text-sm text-white/60">{subtitle}</p>
      </div>

      {rows.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
          V tejto sekcii zatiaľ nič nie je.
        </div>
      ) : (
        <ul className="mt-4 space-y-3">
          {rows.map((r) => {
            const startIn = daysUntil(r.date_from);

            const canConfirm = r.status === "pending" && r.payment_status === "paid";
            const canMarkHandedOver = r.status === "confirmed";
            const canConfirmReturn = r.status === "return_pending_confirmation";
            const canCancel =
              r.status !== "cancelled" &&
              r.status !== "completed" &&
              r.status !== "in_rental";
            const canMarkDisputed =
              r.status === "confirmed" ||
              r.status === "in_rental" ||
              r.status === "return_pending_confirmation";

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

                    <div className="text-white/80">
                      <span className="text-white/50">Zákazník:</span> {shortId(r.renter_id)}
                    </div>

                    <div className="text-white/80">
                      <span className="text-white/50">Termín:</span> {formatDate(r.date_from)} →{" "}
                      {formatDate(r.date_to)}
                    </div>

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

                  {canMarkHandedOver ? (
                    <button
                      className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                      onClick={() => updateReservationStatus(r.id, "in_rental")}
                      type="button"
                    >
                      Označiť ako odovzdané
                    </button>
                  ) : null}

                  {canConfirmReturn ? (
                    <button
                      className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                      onClick={() => updateReservationStatus(r.id, "completed")}
                      type="button"
                    >
                      Potvrdiť vrátenie
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

                  <Link
                    href={`/items/${r.item_id}`}
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                  >
                    Detail ponuky
                  </Link>
                </div>

                {r.payment_status !== "paid" && r.status === "pending" ? (
                  <div className="mt-3 text-sm text-white/60">
                    Potvrdenie je dostupné až po úspešnej platbe.
                  </div>
                ) : null}
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
              Prehľad objednávok zákazníkov a ich posúvanie cez celý prenájom.
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
          subtitle="Nástroj je u zákazníka"
        />
        <SummaryCard
          title="Čaká na vrátenie"
          value={returnPending.length}
          subtitle="Zákazník označil vrátenie"
        />
      </div>

      <Section
        title="Čakajúce rezervácie"
        subtitle="Nové rezervácie, ktoré ešte neboli potvrdené."
        rows={pending}
      />

      <Section
        title="Potvrdené rezervácie"
        subtitle="Rezervácie schválené a pripravené na odovzdanie."
        rows={confirmed}
      />

      <Section
        title="Prebiehajúce prenájmy"
        subtitle="Tieto rezervácie sú už odovzdané zákazníkovi."
        rows={inRental}
      />

      <Section
        title="Čaká na potvrdenie vrátenia"
        subtitle="Zákazník tvrdí, že vrátil, prenajímateľ má potvrdiť ukončenie."
        rows={returnPending}
      />

      <Section
        title="Dokončené rezervácie"
        subtitle="Prenájom bol úspešne ukončený."
        rows={completed}
      />

      <Section
        title="Sporné rezervácie"
        subtitle="Rezervácie označené ako spor."
        rows={disputed}
      />

      <Section
        title="Zrušené rezervácie"
        subtitle="História zrušených rezervácií."
        rows={cancelled}
      />
    </main>
  );
}
