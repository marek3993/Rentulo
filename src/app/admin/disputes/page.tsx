"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
  payment_status: string | null;
};

type ItemRow = {
  id: number;
  title: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  city: string | null;
};

type CurrentUserRow = {
  id: string;
  role: string | null;
};

const PAGE_SIZE = 12;

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("sk-SK");
}

function shortId(id: string) {
  if (!id) return "-";
  if (id.length <= 12) return id;
  return `${id.slice(0, 8)}...${id.slice(-4)}`;
}

function disputeLabel(status: DisputeStatus) {
  if (status === "open") return "Otvorený";
  if (status === "under_review") return "V riešení";
  if (status === "resolved") return "Vyriešený";
  if (status === "closed") return "Uzavretý";
  return status;
}

function disputeBadgeClass(status: DisputeStatus) {
  if (status === "open") return "bg-red-600/90 text-white";
  if (status === "under_review") return "bg-yellow-400 text-black";
  if (status === "resolved") return "bg-emerald-600/90 text-white";
  if (status === "closed") return "bg-white/10 text-white";
  return "bg-white/10 text-white";
}

function pageCount(total: number) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

export default function AdminDisputesPage() {
  const router = useRouter();

  const [statusText, setStatusText] = useState("Načítavam...");
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [total, setTotal] = useState(0);

  const [itemTitleMap, setItemTitleMap] = useState<Record<number, string>>({});
  const [reservationMap, setReservationMap] = useState<Record<number, ReservationRow>>({});
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({});

  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setPage(1);
      setDebouncedQ(q.trim());
    }, 250);

    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setStatusText("Načítavam...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.replace("/login");
      return;
    }

    const { data: me, error: meError } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", userId)
      .maybeSingle();

    if (meError) {
      setStatusText("Chyba: " + meError.message);
      return;
    }

    const meRow = me as CurrentUserRow | null;

    if (!meRow || meRow.role !== "admin") {
      router.replace("/");
      return;
    }

    let req = supabase
      .from("disputes")
      .select(
        "id,reservation_id,item_id,renter_id,owner_id,reason,details,status,created_at,updated_at",
        { count: "exact" }
      );

    if (statusFilter !== "all") {
      req = req.eq("status", statusFilter);
    }

    const queryText = debouncedQ.replace(/,/g, " ").trim();

    if (queryText) {
      if (/^\d+$/.test(queryText)) {
        req = req.or(
          `id.eq.${Number(queryText)},reservation_id.eq.${Number(
            queryText
          )},item_id.eq.${Number(queryText)}`
        );
      } else {
        req = req.or(`reason.ilike.%${queryText}%,details.ilike.%${queryText}%`);
      }
    }

    req = req.order("id", { ascending: sort === "oldest" });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await req.range(from, to);

    if (error) {
      setStatusText("Chyba: " + error.message);
      return;
    }

    const disputeRows = (data ?? []) as DisputeRow[];
    setRows(disputeRows);
    setTotal(count ?? 0);

    const itemIds = Array.from(new Set(disputeRows.map((row) => row.item_id)));
    const reservationIds = Array.from(new Set(disputeRows.map((row) => row.reservation_id)));
    const profileIds = Array.from(
      new Set(disputeRows.flatMap((row) => [row.renter_id, row.owner_id]))
    );

    if (itemIds.length > 0) {
      const { data: itemsData } = await supabase.from("items").select("id,title").in("id", itemIds);
      const nextItemMap: Record<number, string> = {};
      for (const item of (itemsData ?? []) as ItemRow[]) {
        nextItemMap[item.id] = item.title;
      }
      setItemTitleMap(nextItemMap);
    } else {
      setItemTitleMap({});
    }

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

    if (profileIds.length > 0) {
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id,full_name,city")
        .in("id", profileIds);

      const nextProfileMap: Record<string, ProfileRow> = {};
      for (const profile of (profilesData ?? []) as ProfileRow[]) {
        nextProfileMap[profile.id] = profile;
      }
      setProfileMap(nextProfileMap);
    } else {
      setProfileMap({});
    }

    setStatusText("");
  }, [debouncedQ, page, router, sort, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const changeDisputeStatus = async (
    disputeId: number,
    nextStatus: "under_review" | "resolved" | "closed"
  ) => {
    setUpdatingId(disputeId);
    setStatusText("Ukladám zmenu...");

    const { error } = await supabase
      .from("disputes")
      .update({
        status: nextStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", disputeId);

    if (error) {
      setUpdatingId(null);
      setStatusText("Chyba: " + error.message);
      alert(error.message);
      return;
    }

    setUpdatingId(null);
    setStatusText("Stav sporu bol uložený ✅");
    await load();
  };

  const openCount = useMemo(() => rows.filter((r) => r.status === "open").length, [rows]);
  const reviewCount = useMemo(
    () => rows.filter((r) => r.status === "under_review").length,
    [rows]
  );
  const resolvedCount = useMemo(
    () => rows.filter((r) => r.status === "resolved" || r.status === "closed").length,
    [rows]
  );

  const totalPages = pageCount(total);

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Admin · Spory</h1>
            <p className="mt-1 text-white/60">Prehľad všetkých sporov v systéme.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
              Spolu: <strong className="text-white">{total}</strong>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white/70">
              Strana: <strong className="text-white">{page}</strong> / {totalPages}
            </div>
          </div>
        </div>
      </div>

      {statusText ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">{statusText}</div>
      ) : null}

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <div className="mb-1 text-sm text-white/70">Hľadať</div>
            <input
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white outline-none placeholder:text-white/35"
              placeholder="ID, dôvod alebo detail"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm text-white/70">Stav</div>
            <select
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white outline-none"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all" className="text-black">
                Všetky
              </option>
              <option value="open" className="text-black">
                Otvorené
              </option>
              <option value="under_review" className="text-black">
                V riešení
              </option>
              <option value="resolved" className="text-black">
                Vyriešené
              </option>
              <option value="closed" className="text-black">
                Uzavreté
              </option>
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-sm text-white/70">Triedenie</div>
            <select
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white outline-none"
              value={sort}
              onChange={(e) => {
                setSort(e.target.value);
                setPage(1);
              }}
            >
              <option value="newest" className="text-black">
                Najnovšie
              </option>
              <option value="oldest" className="text-black">
                Najstaršie
              </option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Otvorené</div>
          <div className="mt-2 text-2xl font-semibold">{openCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">V riešení</div>
          <div className="mt-2 text-2xl font-semibold">{reviewCount}</div>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Vyriešené / uzavreté</div>
          <div className="mt-2 text-2xl font-semibold">{resolvedCount}</div>
        </div>
      </div>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Zoznam sporov</h2>
            <p className="mt-1 text-sm text-white/60">
              Zobrazené: {rows.length} z {total}
            </p>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Žiadne spory podľa zvolených filtrov.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const reservation = reservationMap[row.reservation_id];
              const renter = profileMap[row.renter_id];
              const owner = profileMap[row.owner_id];

              const canMoveToReview = row.status === "open";
              const canResolve = row.status === "open" || row.status === "under_review";
              const canClose =
                row.status === "open" ||
                row.status === "under_review" ||
                row.status === "resolved";

              return (
                <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white/50">Spor</span>
                        <strong className="text-base">#{row.id}</strong>
                        <span
                          className={`rounded-full px-3 py-1 text-sm font-medium ${disputeBadgeClass(
                            row.status
                          )}`}
                        >
                          {disputeLabel(row.status)}
                        </span>
                      </div>

                      <div className="text-white/85">
                        <span className="text-white/50">Položka:</span>{" "}
                        <strong>{itemTitleMap[row.item_id] ?? `#${row.item_id}`}</strong>
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">Rezervácia:</span> #{row.reservation_id}
                      </div>

                      {reservation ? (
                        <>
                          <div className="text-white/80">
                            <span className="text-white/50">Termín:</span>{" "}
                            {formatDate(reservation.date_from)} → {formatDate(reservation.date_to)}
                          </div>

                          <div className="text-white/80">
                            <span className="text-white/50">Stav rezervácie:</span>{" "}
                            {reservation.status}
                          </div>

                          {reservation.payment_status ? (
                            <div className="text-white/80">
                              <span className="text-white/50">Platba:</span>{" "}
                              {reservation.payment_status}
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      <div className="text-white/80">
                        <span className="text-white/50">Nájomca:</span>{" "}
                        {renter?.full_name?.trim() || shortId(row.renter_id)}
                        {renter?.city ? ` · ${renter.city}` : ""}
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">Prenajímateľ:</span>{" "}
                        {owner?.full_name?.trim() || shortId(row.owner_id)}
                        {owner?.city ? ` · ${owner.city}` : ""}
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">Dôvod:</span> {row.reason}
                      </div>

                      {row.details ? (
                        <div className="max-w-4xl whitespace-pre-wrap text-sm text-white/70">
                          {row.details}
                        </div>
                      ) : null}

                      <div className="text-sm text-white/50">
                        Vytvorené: {formatDate(row.created_at)} · Aktualizované:{" "}
                        {formatDate(row.updated_at)}
                      </div>
                    </div>
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
                      href={`/admin/disputes/${row.id}`}
                      className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                    >
                      Detail sporu
                    </Link>

                    <Link
                      href={`/items/${row.item_id}`}
                      className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                    >
                      Detail ponuky
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Predchádzajúca
          </button>

          <div className="text-sm text-white/60">
            Strana {page} z {totalPages}
          </div>

          <button
            type="button"
            className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Ďalšia
          </button>
        </div>
      </section>
    </main>
  );
}