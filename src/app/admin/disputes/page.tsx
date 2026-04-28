"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type DisputeRow = {
  id: number;
  reservation_id: number;
  item_id: number;
  renter_id: string;
  owner_id: string;
  status: string;
  dispute_type: string | null;
  title: string | null;
  description: string | null;
  reason: string | null;
  details: string | null;
  resolution_note: string | null;
  reservation_status_after_dispute: string | null;
  rental_amount_snapshot: number | null;
  deposit_amount_snapshot: number | null;
  dispute_requested_outcome: string | null;
  dispute_requested_amount: number | null;
  dispute_decision_outcome: string | null;
  dispute_decision_amount: number | null;
  refund_execution_status: string | null;
  deposit_execution_status: string | null;
  created_at: string;
  updated_at: string;
};

type ReservationRow = {
  id: number;
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
const BASE_STATUSES = ["open", "under_review", "resolved", "rejected", "closed"];
const RESERVATION_STATUS_OPTIONS = [
  "confirmed",
  "in_rental",
  "return_pending_confirmation",
  "completed",
  "cancelled",
  "disputed",
];

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

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("sk-SK");
}

function formatCurrencyAmount(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function formatOptionalText(value: string | null) {
  if (!value) return "-";
  return value.replaceAll("_", " ");
}

function getStatusLabel(status: string) {
  if (status === "open") return "Otvorena";
  if (status === "under_review") return "V rieseni";
  if (status === "resolved") return "Vyriesena";
  if (status === "rejected") return "Zamietnuta";
  if (status === "closed") return "Uzatvorena";
  return status.replaceAll("_", " ");
}

function getStatusBadge(status: string) {
  if (status === "open") return "bg-red-600/90 text-white";
  if (status === "under_review") return "bg-yellow-400 text-black";
  if (status === "resolved") return "bg-emerald-600/90 text-white";
  if (status === "rejected") return "bg-slate-500/90 text-white";
  if (status === "closed") return "bg-white/10 text-white";
  return "bg-blue-600/90 text-white";
}

function getTitle(row: DisputeRow) {
  return row.title || row.reason || `Reklamacia #${row.id}`;
}

function getDescription(row: DisputeRow) {
  return row.description || row.details || "";
}

function shortId(value: string) {
  if (value.length <= 12) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function needsReservationStatus(status: string) {
  return status === "resolved" || status === "rejected" || status === "closed";
}

export default function AdminDisputesPage() {
  const router = useRouter();

  const [statusText, setStatusText] = useState("Nacitavam...");
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [itemTitleMap, setItemTitleMap] = useState<Record<number, string>>({});
  const [reservationMap, setReservationMap] = useState<Record<number, ReservationRow>>({});
  const [profileMap, setProfileMap] = useState<Record<string, ProfileRow>>({});
  const [availableStatuses, setAvailableStatuses] = useState<string[]>(BASE_STATUSES);

  const [nextStatusMap, setNextStatusMap] = useState<Record<number, string>>({});
  const [resolutionNoteMap, setResolutionNoteMap] = useState<Record<number, string>>({});
  const [reservationStatusAfterMap, setReservationStatusAfterMap] = useState<Record<number, string>>({});
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      setDebouncedQuery(query.trim());
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const load = async () => {
    setStatusText("Nacitavam...");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      router.replace("/login");
      return;
    }

    const { data: meData, error: meError } = await supabase
      .from("profiles")
      .select("id,role")
      .eq("id", userId)
      .maybeSingle();

    if (meError) {
      setStatusText("Chyba: " + meError.message);
      return;
    }

    const me = (meData ?? null) as CurrentUserRow | null;
    if (!me || me.role !== "admin") {
      router.replace("/");
      return;
    }

    let request = supabase
      .from("disputes")
      .select(
        "id,reservation_id,item_id,renter_id,owner_id,status,dispute_type,title,description,reason,details,resolution_note,reservation_status_after_dispute,rental_amount_snapshot,deposit_amount_snapshot,dispute_requested_outcome,dispute_requested_amount,dispute_decision_outcome,dispute_decision_amount,refund_execution_status,deposit_execution_status,created_at,updated_at",
        { count: "exact" }
      );

    if (statusFilter !== "all") {
      request = request.eq("status", statusFilter);
    }

    if (debouncedQuery) {
      if (/^\d+$/.test(debouncedQuery)) {
        request = request.or(
          `id.eq.${Number(debouncedQuery)},reservation_id.eq.${Number(debouncedQuery)},item_id.eq.${Number(debouncedQuery)}`
        );
      } else {
        request = request.or(
          `title.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%,reason.ilike.%${debouncedQuery}%,details.ilike.%${debouncedQuery}%`
        );
      }
    }

    request = request.order("id", { ascending: sort === "oldest" });

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const { data, error, count } = await request.range(from, to);

    if (error) {
      setStatusText("Chyba: " + error.message);
      return;
    }

    const disputeRows = (data ?? []) as DisputeRow[];
    setRows(disputeRows);
    setTotal(count ?? 0);
    setAvailableStatuses(Array.from(new Set([...BASE_STATUSES, ...disputeRows.map((row) => row.status)])));

    setNextStatusMap(Object.fromEntries(disputeRows.map((row) => [row.id, row.status])));
    setResolutionNoteMap(Object.fromEntries(disputeRows.map((row) => [row.id, row.resolution_note ?? ""])));
    setReservationStatusAfterMap(
      Object.fromEntries(disputeRows.map((row) => [row.id, row.reservation_status_after_dispute ?? ""]))
    );

    const itemIds = Array.from(new Set(disputeRows.map((row) => row.item_id)));
    const reservationIds = Array.from(new Set(disputeRows.map((row) => row.reservation_id)));
    const profileIds = Array.from(
      new Set(disputeRows.flatMap((row) => [row.renter_id, row.owner_id]).filter(Boolean))
    );

    const [itemsResult, reservationsResult, profilesResult] = await Promise.all([
      itemIds.length > 0
        ? supabase.from("items").select("id,title").in("id", itemIds)
        : Promise.resolve({ data: [] as ItemRow[], error: null }),
      reservationIds.length > 0
        ? supabase
            .from("reservations")
            .select("id,date_from,date_to,status,payment_status")
            .in("id", reservationIds)
        : Promise.resolve({ data: [] as ReservationRow[], error: null }),
      profileIds.length > 0
        ? supabase.from("profiles").select("id,full_name,city").in("id", profileIds)
        : Promise.resolve({ data: [] as ProfileRow[], error: null }),
    ]);

    const itemMap: Record<number, string> = {};
    for (const row of (itemsResult.data ?? []) as ItemRow[]) {
      itemMap[row.id] = row.title;
    }
    setItemTitleMap(itemMap);

    const nextReservationMap: Record<number, ReservationRow> = {};
    for (const row of (reservationsResult.data ?? []) as ReservationRow[]) {
      nextReservationMap[row.id] = row;
    }
    setReservationMap(nextReservationMap);

    const nextProfileMap: Record<string, ProfileRow> = {};
    for (const row of (profilesResult.data ?? []) as ProfileRow[]) {
      nextProfileMap[row.id] = row;
    }
    setProfileMap(nextProfileMap);

    setStatusText("");
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, statusFilter, debouncedQuery]);

  const updateStatus = async (row: DisputeRow) => {
    const nextStatus = (nextStatusMap[row.id] || "").trim();
    const resolutionNote = (resolutionNoteMap[row.id] || "").trim();
    const reservationStatusAfter = (reservationStatusAfterMap[row.id] || "").trim();

    if (!nextStatus) {
      setStatusText("Zadajte dalsi status reklamacie.");
      alert("Zadajte dalsi status reklamacie.");
      return;
    }

    if (needsReservationStatus(nextStatus) && !reservationStatusAfter) {
      setStatusText("Vyberte vysledny stav rezervacie.");
      alert("Vyberte vysledny stav rezervacie.");
      return;
    }

    setUpdatingId(row.id);
    setStatusText("Ukladam zmenu...");

    const { error } = await supabase.rpc("dispute_set_status_v2", {
      p_dispute_id: row.id,
      p_next_status: nextStatus,
      p_resolution_note: resolutionNote || null,
      p_reservation_status_after_dispute: needsReservationStatus(nextStatus)
        ? reservationStatusAfter
        : null,
      p_dispute_decision_outcome: null,
      p_dispute_decision_amount: null,
    });

    if (error) {
      setUpdatingId(null);
      setStatusText("Chyba: " + error.message);
      alert(error.message);
      return;
    }

    setUpdatingId(null);
    await load();
  };

  const openCount = useMemo(() => rows.filter((row) => row.status === "open").length, [rows]);
  const reviewCount = useMemo(() => rows.filter((row) => row.status === "under_review").length, [rows]);
  const closedCount = useMemo(
    () =>
      rows.filter(
        (row) => row.status === "resolved" || row.status === "rejected" || row.status === "closed"
      ).length,
    [rows]
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Admin · Reklamacie</h1>
            <p className="mt-1 text-white/60">V2 baseline pre reklamacie bez notif patchu.</p>
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
            <div className="mb-1 text-sm text-white/70">Hladat</div>
            <input
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white outline-none placeholder:text-white/35"
              placeholder="ID, nazov, popis"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm text-white/70">Status</div>
            <select
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white outline-none"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all" className="text-black">
                Vsetky
              </option>
              {availableStatuses.map((status) => (
                <option key={status} value={status} className="text-black">
                  {getStatusLabel(status)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <div className="mb-1 text-sm text-white/70">Triedenie</div>
            <select
              className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white outline-none"
              value={sort}
              onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}
            >
              <option value="newest" className="text-black">
                Najnovsie
              </option>
              <option value="oldest" className="text-black">
                Najstarsie
              </option>
            </select>
          </label>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Otvorene</div>
          <div className="mt-2 text-2xl font-semibold">{openCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">V rieseni</div>
          <div className="mt-2 text-2xl font-semibold">{reviewCount}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <div className="text-sm text-white/60">Uzatvorene</div>
          <div className="mt-2 text-2xl font-semibold">{closedCount}</div>
        </div>
      </div>

      <datalist id="admin-dispute-status-suggestions">
        {availableStatuses.map((status) => (
          <option key={status} value={status} />
        ))}
      </datalist>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Zoznam reklamacii</h2>
          <p className="mt-1 text-sm text-white/60">Zobrazene: {rows.length} z {total}</p>
        </div>

        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Zatial nic pre zvolene filtre.
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const reservation = reservationMap[row.reservation_id];
              const renter = profileMap[row.renter_id];
              const owner = profileMap[row.owner_id];
              const selectedStatus = nextStatusMap[row.id] ?? row.status;
              const description = getDescription(row);

              return (
                <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white/50">Reklamacia</span>
                        <strong className="text-base">#{row.id}</strong>
                        <span className={`rounded-full px-3 py-1 text-sm font-medium ${getStatusBadge(row.status)}`}>
                          {getStatusLabel(row.status)}
                        </span>
                      </div>

                      <div className="text-lg font-semibold text-white">{getTitle(row)}</div>

                      <div className="text-white/80">
                        <span className="text-white/50">Polozka:</span>{" "}
                        <strong>{itemTitleMap[row.item_id] ?? `#${row.item_id}`}</strong>
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">Rezervacia:</span> #{row.reservation_id}
                      </div>

                      {reservation ? (
                        <>
                          <div className="text-white/80">
                            <span className="text-white/50">Termin:</span>{" "}
                            {formatDate(reservation.date_from)} - {formatDate(reservation.date_to)}
                          </div>
                          <div className="text-white/80">
                            <span className="text-white/50">Stav rezervacie:</span>{" "}
                            {getReservationStatusLabel(reservation.status)}
                          </div>
                          <div className="text-white/80">
                            <span className="text-white/50">Stav platby:</span>{" "}
                            {getPaymentStatusLabel(reservation.payment_status)}
                          </div>
                        </>
                      ) : null}

                      <div className="text-white/80">
                        <span className="text-white/50">Najomca:</span>{" "}
                        {renter?.full_name || shortId(row.renter_id)}
                        {renter?.city ? ` · ${renter.city}` : ""}
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">Prenajimatel:</span>{" "}
                        {owner?.full_name || shortId(row.owner_id)}
                        {owner?.city ? ` · ${owner.city}` : ""}
                      </div>

                      {row.dispute_type ? (
                        <div className="text-white/80">
                          <span className="text-white/50">Typ:</span> {getDisputeTypeLabel(row.dispute_type)}
                        </div>
                      ) : null}

                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/75">
                        <div className="font-medium text-white">Financie</div>
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <div>
                            <span className="text-white/45">Pozadovane:</span>{" "}
                            {formatOptionalText(row.dispute_requested_outcome)} ·{" "}
                            {formatCurrencyAmount(row.dispute_requested_amount)}
                          </div>
                          <div>
                            <span className="text-white/45">Rozhodnute:</span>{" "}
                            {formatOptionalText(row.dispute_decision_outcome)} ·{" "}
                            {formatCurrencyAmount(row.dispute_decision_amount)}
                          </div>
                          <div>
                            <span className="text-white/45">Refund:</span>{" "}
                            {formatOptionalText(row.refund_execution_status)}
                          </div>
                          <div>
                            <span className="text-white/45">Depozit:</span>{" "}
                            {formatOptionalText(row.deposit_execution_status)}
                          </div>
                          <div>
                            <span className="text-white/45">Snapshot prenajmu:</span>{" "}
                            {formatCurrencyAmount(row.rental_amount_snapshot)}
                          </div>
                          <div>
                            <span className="text-white/45">Snapshot depozitu:</span>{" "}
                            {formatCurrencyAmount(row.deposit_amount_snapshot)}
                          </div>
                        </div>
                      </div>

                      {description ? (
                        <div className="max-w-4xl whitespace-pre-wrap text-sm text-white/70">
                          {description}
                        </div>
                      ) : null}

                      <div className="text-sm text-white/50">
                        Vytvorene: {formatDate(row.created_at)} · Aktualizovane: {formatDate(row.updated_at)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1.2fr_1fr]">
                    <label className="block">
                      <div className="mb-1 text-sm text-white/70">Dalsi status</div>
                      <input
                        className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white outline-none"
                        list="admin-dispute-status-suggestions"
                        value={selectedStatus}
                        onChange={(event) =>
                          setNextStatusMap((prev) => ({
                            ...prev,
                            [row.id]: event.target.value,
                          }))
                        }
                        disabled={updatingId === row.id}
                      />
                    </label>

                    <label className="block">
                      <div className="mb-1 text-sm text-white/70">Poznamka k rozhodnutiu</div>
                      <textarea
                        className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white outline-none"
                        rows={3}
                        value={resolutionNoteMap[row.id] ?? ""}
                        onChange={(event) =>
                          setResolutionNoteMap((prev) => ({
                            ...prev,
                            [row.id]: event.target.value,
                          }))
                        }
                        disabled={updatingId === row.id}
                      />
                    </label>

                    {needsReservationStatus(selectedStatus.trim()) ? (
                      <label className="block">
                        <div className="mb-1 text-sm text-white/70">Vysledny stav rezervacie</div>
                        <select
                          className="w-full rounded-xl border border-white/15 bg-black/20 px-3 py-2 text-white outline-none"
                          value={reservationStatusAfterMap[row.id] ?? ""}
                          onChange={(event) =>
                            setReservationStatusAfterMap((prev) => ({
                              ...prev,
                              [row.id]: event.target.value,
                            }))
                          }
                          disabled={updatingId === row.id}
                        >
                          <option value="" className="text-black">
                            Vyberte stav rezervacie
                          </option>
                          {RESERVATION_STATUS_OPTIONS.map((option) => (
                            <option key={option} value={option} className="text-black">
                              {getReservationStatusLabel(option)}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-white/55">
                        Vysledny stav rezervacie je povinny pri vyrieseni, zamietnuti a uzatvoreni.
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
                      disabled={updatingId === row.id}
                      onClick={() => updateStatus(row)}
                    >
                      {updatingId === row.id ? "Ukladam..." : "Ulozit stav"}
                    </button>

                    <Link
                      href={`/admin/disputes/${row.id}`}
                      className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                    >
                      Detail reklamacie
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
            onClick={() => setPage((value) => Math.max(1, value - 1))}
          >
            Predchadzajuca
          </button>

          <div className="text-sm text-white/60">Strana {page} z {totalPages}</div>

          <button
            type="button"
            className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
          >
            Dalsia
          </button>
        </div>
      </section>
    </main>
  );
}
