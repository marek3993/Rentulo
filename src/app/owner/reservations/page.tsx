"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Row = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  status: "pending" | "confirmed" | "cancelled" | string;
  payment_status: "unpaid" | "paid" | "failed" | string;
  payment_provider: string;
  renter_id: string;
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

function reservationBadge(status: string) {
  if (status === "confirmed") return "bg-green-600/90 text-white";
  if (status === "pending") return "bg-yellow-400 text-black";
  if (status === "cancelled") return "bg-red-600/90 text-white";
  return "bg-white/10 text-white";
}

function paymentBadge(status: string) {
  if (status === "paid") return "bg-green-600/90 text-white";
  if (status === "failed") return "bg-red-600/90 text-white";
  return "bg-yellow-400 text-black";
}

export default function OwnerReservationsPage() {
  const router = useRouter();

  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState("Načítavam...");
  const [itemTitleMap, setItemTitleMap] = useState<Record<number, string>>({});

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("reservations")
      .select("id,item_id,date_from,date_to,status,payment_status,payment_provider,renter_id")
      .order("id", { ascending: false });

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const reservationRows = (data ?? []) as Row[];
    setRows(reservationRows);

    const itemIds = Array.from(new Set(reservationRows.map((r) => r.item_id)));
    if (itemIds.length > 0) {
      const { data: itemsData } = await supabase
        .from("items")
        .select("id,title")
        .in("id", itemIds);

      const map: Record<number, string> = {};
      for (const item of (itemsData ?? []) as any[]) {
        map[item.id] = item.title;
      }
      setItemTitleMap(map);
    } else {
      setItemTitleMap({});
    }

    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateStatus = async (id: number, nextStatus: "confirmed" | "cancelled") => {
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
            const canConfirm = r.status !== "confirmed" && r.status !== "cancelled" && r.payment_status === "paid";
            const canCancel = r.status !== "cancelled";
            const startIn = daysUntil(r.date_from);

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
                      {r.status === "pending"
                        ? "Čaká na potvrdenie"
                        : r.status === "confirmed"
                        ? "Potvrdená"
                        : r.status === "cancelled"
                        ? "Zrušená"
                        : r.status}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${paymentBadge(
                        r.payment_status
                      )}`}
                    >
                      {r.payment_status === "unpaid"
                        ? "Nezaplatené"
                        : r.payment_status === "paid"
                        ? "Zaplatené"
                        : r.payment_status === "failed"
                        ? "Platba zlyhala"
                        : r.payment_status}
                    </span>
                  </div>
                </div>

                <div className="mt-3 text-sm text-white/50">
                  Poskytovateľ platby: {r.payment_provider}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => updateStatus(r.id, "confirmed")}
                    disabled={!canConfirm}
                    type="button"
                  >
                    Potvrdiť
                  </button>

                  <button
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    onClick={() => updateStatus(r.id, "cancelled")}
                    disabled={!canCancel}
                    type="button"
                  >
                    Zrušiť
                  </button>

                  <Link
                    href={`/items/${r.item_id}`}
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                  >
                    Detail ponuky
                  </Link>
                </div>

                {r.payment_status !== "paid" && r.status !== "cancelled" ? (
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
              Prehľad objednávok zákazníkov, platieb a potvrdení.
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

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          title="Čakajúce"
          value={pending.length}
          subtitle="Rezervácie čakajúce na tvoje rozhodnutie"
        />
        <SummaryCard
          title="Potvrdené"
          value={confirmed.length}
          subtitle="Pripravené alebo prebiehajúce prenájmy"
        />
        <SummaryCard
          title="Zrušené"
          value={cancelled.length}
          subtitle="História zrušených rezervácií"
        />
      </div>

      <Section
        title="Čakajúce rezervácie"
        subtitle="Nové rezervácie, ktoré ešte neboli potvrdené."
        rows={pending}
      />

      <Section
        title="Potvrdené rezervácie"
        subtitle="Rezervácie, ktoré sú potvrdené a pripravené na odovzdanie."
        rows={confirmed}
      />

      <Section
        title="Zrušené rezervácie"
        subtitle="História rezervácií, ktoré boli zrušené."
        rows={cancelled}
      />
    </main>
  );
}