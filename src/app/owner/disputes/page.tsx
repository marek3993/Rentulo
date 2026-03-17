"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  Badge,
  KpiCard,
  Notice,
  Pagination,
  Section,
  SelectField,
  TextField,
} from "@/components/owner/OwnerUI";

type DisputeStatus = "open" | "under_review" | "resolved" | "closed" | string;

type DisputeRow = {
  id: number;
  reservation_id: number;
  item_id: number;
  renter_id: string;
  owner_id: string;
  reason: string;
  details: string | null;
  status: DisputeStatus;
  created_at: string;
  updated_at: string;
};

type ReservationRow = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  status: string;
  payment_status: string;
};

type ItemRow = {
  id: number;
  title: string;
  owner_id: string;
};

const PAGE_SIZE = 12;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function disputeLabel(status: DisputeStatus) {
  if (status === "open") return "Otvorený";
  if (status === "under_review") return "V riešení";
  if (status === "resolved") return "Vyriešený";
  if (status === "closed") return "Uzavretý";
  return status;
}

function disputeTone(status: DisputeStatus) {
  if (status === "open") return "danger";
  if (status === "under_review") return "warning";
  if (status === "resolved") return "success";
  if (status === "closed") return "neutral";
  return "neutral";
}

export default function OwnerDisputesPage() {
  const router = useRouter();

  const [status, setStatus] = useState("Načítavam...");
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [total, setTotal] = useState(0);

  const [itemTitleMap, setItemTitleMap] = useState<Record<number, string>>({});
  const [reservationMap, setReservationMap] = useState<Record<number, ReservationRow>>({});

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const load = async () => {
    setStatus("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { data: ownedItems, error: itemsError } = await supabase
      .from("items")
      .select("id,title,owner_id")
      .eq("owner_id", userId);

    if (itemsError) {
      setStatus("Chyba: " + itemsError.message);
      return;
    }

    const itemRows = (ownedItems ?? []) as ItemRow[];
    const ownedItemIds = itemRows.map((item) => item.id);

    const nextTitleMap: Record<number, string> = {};
    for (const item of itemRows) {
      nextTitleMap[item.id] = item.title;
    }
    setItemTitleMap(nextTitleMap);

    if (ownedItemIds.length === 0) {
      setRows([]);
      setReservationMap({});
      setTotal(0);
      setStatus("");
      return;
    }

    let req = supabase
      .from("disputes")
      .select("id,reservation_id,item_id,renter_id,owner_id,reason,details,status,created_at,updated_at", {
        count: "exact",
      })
      .eq("owner_id", userId)
      .in("item_id", ownedItemIds);

    if (statusFilter !== "all") {
      req = req.eq("status", statusFilter);
    }

    const queryText = q.trim();
    if (queryText) {
      if (/^\d+$/.test(queryText)) {
        req = req.or(`id.eq.${Number(queryText)},reservation_id.eq.${Number(queryText)},item_id.eq.${Number(queryText)}`);
      } else {
        req = req.or(`reason.ilike.%${queryText}%,details.ilike.%${queryText}%`);
      }
    }

    req = req.order("id", { ascending: sort === "oldest" });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await req.range(from, to);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    const disputeRows = (data ?? []) as DisputeRow[];
    setRows(disputeRows);
    setTotal(count ?? 0);

    const reservationIds = Array.from(new Set(disputeRows.map((row) => row.reservation_id)));
    if (reservationIds.length > 0) {
      const { data: reservationData } = await supabase
        .from("reservations")
        .select("id,item_id,date_from,date_to,status,payment_status")
        .in("id", reservationIds);

      const nextReservationMap: Record<number, ReservationRow> = {};
      for (const reservation of (reservationData ?? []) as ReservationRow[]) {
        nextReservationMap[reservation.id] = reservation;
      }
      setReservationMap(nextReservationMap);
    } else {
      setReservationMap({});
    }

    setStatus("");
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, sort]);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      load();
    }, 250);

    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const openCount = useMemo(() => rows.filter((r) => r.status === "open").length, [rows]);
  const reviewCount = useMemo(() => rows.filter((r) => r.status === "under_review").length, [rows]);
  const closedCount = useMemo(
    () => rows.filter((r) => r.status === "resolved" || r.status === "closed").length,
    [rows]
  );

  const changeDisputeStatus = async (id: number, nextStatus: "under_review" | "resolved" | "closed") => {
    setUpdatingId(id);
    setStatus("Ukladám zmenu...");

    const { error } = await supabase
      .from("disputes")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (error) {
      setUpdatingId(null);
      setStatus("Chyba: " + error.message);
      alert(error.message);
      return;
    }

    setUpdatingId(null);
    setStatus("Stav reklamácie bol uložený ✅");
    await load();
  };

  return (
    <main className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Reklamácie</h2>
        <p className="mt-1 text-white/60">
          Prehľad sporov zákazníkov k tvojim rezerváciám.
        </p>
      </div>

      {status ? <Notice text={status} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <KpiCard title="Zobrazené" value={rows.length} hint="Počet v aktuálnom zozname" />
        <KpiCard title="Otvorené" value={openCount} hint="Na aktuálnej strane" />
        <KpiCard title="Vyriešené / uzavreté" value={closedCount} hint="Na aktuálnej strane" />
      </div>

      <Section
        title="Vyhľadávanie a filtre"
        subtitle="Filtruj podľa stavu alebo hľadaj podľa ID, dôvodu a detailov."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <TextField
            id="owner-dispute-search"
            label="Hľadať"
            value={q}
            onChange={setQ}
            placeholder="ID, dôvod alebo detail"
          />

          <SelectField
            id="owner-dispute-status"
            label="Stav"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Všetky" },
              { value: "open", label: "Otvorené" },
              { value: "under_review", label: "V riešení" },
              { value: "resolved", label: "Vyriešené" },
              { value: "closed", label: "Uzavreté" },
            ]}
          />

          <SelectField
            id="owner-dispute-sort"
            label="Triedenie"
            value={sort}
            onChange={(v) => {
              setSort(v);
              setPage(1);
            }}
            options={[
              { value: "newest", label: "Najnovšie" },
              { value: "oldest", label: "Najstaršie" },
            ]}
          />
        </div>
      </Section>

      <Section
        title="Zoznam reklamácií"
        subtitle={`Zobrazené: ${rows.length} z ${total}`}
      >
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Žiadne reklamácie podľa zvolených filtrov.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const reservation = reservationMap[row.reservation_id];

              const canMoveToReview = row.status === "open";
              const canResolve = row.status === "open" || row.status === "under_review";
              const canClose =
                row.status === "open" || row.status === "under_review" || row.status === "resolved";

              return (
                <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white/50">Reklamácia</span>
                        <strong className="text-base">#{row.id}</strong>
                      </div>

                      <div className="text-white/85">
                        <span className="text-white/50">Položka:</span>{" "}
                        <strong>{itemTitleMap[row.item_id] ?? `#${row.item_id}`}</strong>
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

                      <div className="text-sm text-white/50">
                        Vytvorené: {formatDate(row.created_at)} · Aktualizované: {formatDate(row.updated_at)}
                      </div>
                    </div>

                    <Badge tone={disputeTone(row.status)}>{disputeLabel(row.status)}</Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {canMoveToReview ? (
                      <button
                        type="button"
                        className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                        disabled={updatingId === row.id}
                        onClick={() => changeDisputeStatus(row.id, "under_review")}
                      >
                        {updatingId === row.id ? "Ukladám..." : "Označiť ako v riešení"}
                      </button>
                    ) : null}

                    {canResolve ? (
                      <button
                        type="button"
                        className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                        disabled={updatingId === row.id}
                        onClick={() => changeDisputeStatus(row.id, "resolved")}
                      >
                        {updatingId === row.id ? "Ukladám..." : "Označiť ako vyriešené"}
                      </button>
                    ) : null}

                    {canClose ? (
                      <button
                        type="button"
                        className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                        disabled={updatingId === row.id}
                        onClick={() => changeDisputeStatus(row.id, "closed")}
                      >
                        {updatingId === row.id ? "Ukladám..." : "Uzavrieť"}
                      </button>
                    ) : null}

                    <Link
                      className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                      href={`/owner/reservations`}
                    >
                      Otvoriť rezervácie
                    </Link>

                    <Link
                      className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                      href={`/items/${row.item_id}`}
                    >
                      Detail ponuky
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      </Section>
    </main>
  );
}