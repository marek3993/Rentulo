"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

type DisputeRow = {
  id: number;
  reservation_id: number;
  item_id: number;
  renter_id: string;
  owner_id: string;
  reason: string;
  details: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type ReservationRow = {
  id: number;
  date_from: string;
  date_to: string;
};

type ItemRow = {
  id: number;
  title: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function disputeBadge(status: string) {
  if (status === "open") return "bg-red-600/90 text-white";
  if (status === "under_review") return "bg-yellow-400 text-black";
  if (status === "resolved") return "bg-emerald-600/90 text-white";
  if (status === "closed") return "bg-white/10 text-white";
  return "bg-white/10 text-white";
}

function disputeLabel(status: string) {
  if (status === "open") return "Otvorený";
  if (status === "under_review") return "V riešení";
  if (status === "resolved") return "Vyriešený";
  if (status === "closed") return "Uzavretý";
  return status;
}

export default function DisputesPage() {
  const router = useRouter();

  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [status, setStatus] = useState("Načítavam...");
  const [itemMap, setItemMap] = useState<Record<number, string>>({});
  const [reservationMap, setReservationMap] = useState<Record<number, ReservationRow>>({});

  useEffect(() => {
    const run = async () => {
      setStatus("Načítavam...");

      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;

      if (!userId) {
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("disputes")
        .select("id,reservation_id,item_id,renter_id,owner_id,reason,details,status,created_at,updated_at")
        .eq("renter_id", userId)
        .order("id", { ascending: false });

      if (error) {
        setStatus("Chyba: " + error.message);
        return;
      }

      const disputeRows = (data ?? []) as DisputeRow[];
      setRows(disputeRows);

      const itemIds = Array.from(new Set(disputeRows.map((r) => r.item_id)));
      const reservationIds = Array.from(new Set(disputeRows.map((r) => r.reservation_id)));

      if (itemIds.length > 0) {
        const { data: itemsData } = await supabase
          .from("items")
          .select("id,title")
          .in("id", itemIds);

        const map: Record<number, string> = {};
        for (const item of (itemsData ?? []) as ItemRow[]) {
          map[item.id] = item.title;
        }
        setItemMap(map);
      } else {
        setItemMap({});
      }

      if (reservationIds.length > 0) {
        const { data: reservationData } = await supabase
          .from("reservations")
          .select("id,date_from,date_to")
          .in("id", reservationIds);

        const map: Record<number, ReservationRow> = {};
        for (const reservation of (reservationData ?? []) as ReservationRow[]) {
          map[reservation.id] = reservation;
        }
        setReservationMap(map);
      } else {
        setReservationMap({});
      }

      setStatus("");
    };

    run();
  }, [router]);

  const openRows = useMemo(() => rows.filter((r) => r.status === "open"), [rows]);
  const reviewRows = useMemo(() => rows.filter((r) => r.status === "under_review"), [rows]);
  const resolvedRows = useMemo(
    () => rows.filter((r) => r.status === "resolved" || r.status === "closed"),
    [rows]
  );

  const renderSection = (title: string, subtitle: string, sectionRows: DisputeRow[]) => (
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
          {sectionRows.map((row) => {
            const reservation = reservationMap[row.reservation_id];

            return (
              <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-white/50">Spor</span>
                      <strong>#{row.id}</strong>
                    </div>

                    <div className="text-white/80">
                      <span className="text-white/50">Položka:</span>{" "}
                      {itemMap[row.item_id] ?? `#${row.item_id}`}
                    </div>

                    <div className="text-white/80">
                      <span className="text-white/50">Rezervácia:</span> #{row.reservation_id}
                    </div>

                    {reservation ? (
                      <div className="text-white/80">
                        <span className="text-white/50">Termín:</span>{" "}
                        {formatDate(reservation.date_from)} → {formatDate(reservation.date_to)}
                      </div>
                    ) : null}

                    <div className="text-white/80">
                      <span className="text-white/50">Dôvod:</span> {row.reason}
                    </div>

                    {row.details ? (
                      <div className="max-w-3xl whitespace-pre-wrap text-sm text-white/70">
                        {row.details}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-3 py-1 text-sm font-medium ${disputeBadge(
                        row.status
                      )}`}
                    >
                      {disputeLabel(row.status)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/items/${row.item_id}`}
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                  >
                    Detail ponuky
                  </Link>

                  <Link
                    href={`/messages`}
                    className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                  >
                    Správy
                  </Link>
                </div>

                <div className="mt-3 text-sm text-white/50">
                  Vytvorené: {formatDate(row.created_at)} · Aktualizované: {formatDate(row.updated_at)}
                </div>
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
            <h1 className="text-2xl font-semibold">Moje spory</h1>
            <p className="mt-1 text-white/60">
              Prehľad problémov, ktoré si nahlásil k rezerváciám.
            </p>
          </div>

          <Link
            href="/reservations"
            className="rounded border border-white/15 px-3 py-2 hover:bg-white/10"
          >
            Späť na rezervácie
          </Link>
        </div>
      </div>

      {status ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{status}</div>
      ) : null}

      {renderSection("Otvorené", "Nové a neuzavreté spory.", openRows)}
      {renderSection("V riešení", "Spory, ktoré sa práve riešia.", reviewRows)}
      {renderSection("História", "Vyriešené alebo uzavreté spory.", resolvedRows)}
    </main>
  );
}