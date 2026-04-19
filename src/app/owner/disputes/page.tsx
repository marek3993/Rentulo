"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  created_at: string;
  updated_at: string;
};

type ReservationRow = {
  id: number;
  date_from: string;
  date_to: string;
  status: string;
};

type ItemRow = {
  id: number;
  title: string;
};

const PAGE_SIZE = 12;
const BASE_STATUSES = ["open", "under_review", "resolved", "rejected", "closed"];

function getDisputeTypeLabel(type: string) {
  if (type === "damage") return "Poskodenie alebo skoda";
  if (type === "not_as_described") return "Vec nezodpoveda popisu";
  if (type === "missing_accessories") return "Chybajuce prislusenstvo";
  if (type === "handover_issue") return "Problem pri odovzdani";
  if (type === "return_issue") return "Problem pri vrateni";
  if (type === "other") return "Ina reklamacia";
  return type.replaceAll("_", " ");
}

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("sk-SK");
}

function getStatusLabel(status: string) {
  if (status === "open") return "Otvorena";
  if (status === "under_review") return "V rieseni";
  if (status === "resolved") return "Vyriesena";
  if (status === "rejected") return "Zamietnuta";
  if (status === "closed") return "Uzatvorena";
  return status.replaceAll("_", " ");
}

function getStatusTone(status: string) {
  if (status === "open") return "danger";
  if (status === "under_review") return "warning";
  if (status === "resolved") return "success";
  if (status === "rejected") return "neutral";
  if (status === "closed") return "neutral";
  return "info";
}

function getTitle(row: DisputeRow) {
  return row.title || row.reason || `Reklamacia #${row.id}`;
}

function getDescription(row: DisputeRow) {
  return row.description || row.details || "";
}

function isClosedLike(status: string) {
  return status === "resolved" || status === "rejected" || status === "closed";
}

export default function OwnerDisputesPage() {
  const router = useRouter();

  const [statusText, setStatusText] = useState("Nacitavam...");
  const [rows, setRows] = useState<DisputeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const [itemTitleMap, setItemTitleMap] = useState<Record<number, string>>({});
  const [reservationMap, setReservationMap] = useState<Record<number, ReservationRow>>({});
  const [availableStatuses, setAvailableStatuses] = useState<string[]>(BASE_STATUSES);

  const load = async (searchValue = query) => {
    setStatusText("Nacitavam...");

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { data: itemsData, error: itemsError } = await supabase
      .from("items")
      .select("id,title")
      .eq("owner_id", userId);

    if (itemsError) {
      setStatusText("Chyba: " + itemsError.message);
      return;
    }

    const itemRows = (itemsData ?? []) as ItemRow[];
    const itemIds = itemRows.map((row) => row.id);
    const nextItemMap: Record<number, string> = {};

    for (const row of itemRows) {
      nextItemMap[row.id] = row.title;
    }

    setItemTitleMap(nextItemMap);

    if (itemIds.length === 0) {
      setRows([]);
      setReservationMap({});
      setTotal(0);
      setStatusText("");
      return;
    }

    let request = supabase
      .from("disputes")
      .select(
        "id,reservation_id,item_id,renter_id,owner_id,status,dispute_type,title,description,reason,details,created_at,updated_at",
        { count: "exact" }
      )
      .eq("owner_id", userId)
      .in("item_id", itemIds);

    if (statusFilter !== "all") {
      request = request.eq("status", statusFilter);
    }

    const trimmedQuery = searchValue.trim();

    if (trimmedQuery) {
      if (/^\d+$/.test(trimmedQuery)) {
        request = request.or(
          `id.eq.${Number(trimmedQuery)},reservation_id.eq.${Number(trimmedQuery)},item_id.eq.${Number(trimmedQuery)}`
        );
      } else {
        request = request.or(
          `title.ilike.%${trimmedQuery}%,description.ilike.%${trimmedQuery}%,reason.ilike.%${trimmedQuery}%,details.ilike.%${trimmedQuery}%`
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

    const reservationIds = Array.from(new Set(disputeRows.map((row) => row.reservation_id)));

    if (reservationIds.length > 0) {
      const { data: reservationData } = await supabase
        .from("reservations")
        .select("id,date_from,date_to,status")
        .in("id", reservationIds);

      const nextReservationMap: Record<number, ReservationRow> = {};
      for (const row of (reservationData ?? []) as ReservationRow[]) {
        nextReservationMap[row.id] = row;
      }
      setReservationMap(nextReservationMap);
    } else {
      setReservationMap({});
    }

    setStatusText("");
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      void load(query);
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const openCount = useMemo(() => rows.filter((row) => row.status === "open").length, [rows]);
  const reviewCount = useMemo(() => rows.filter((row) => row.status === "under_review").length, [rows]);
  const closedCount = useMemo(() => rows.filter((row) => isClosedLike(row.status)).length, [rows]);

  return (
    <main className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Reklamacie</h2>
          <p className="mt-1 text-white/60">Prehlad reklamacii zakaznikov k vasim rezervaciam.</p>
          <p className="mt-2 text-sm text-white/50">
            Novu reklamaciu otvorite z konkretnej rezervacie, aby sa spravne preniesli udaje o prenajme.
          </p>
        </div>

        <Link
          href="/owner/reservations"
          className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
        >
          Nova reklamacia
        </Link>
      </div>

      {statusText ? <Notice text={statusText} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <KpiCard title="Zobrazene" value={rows.length} hint="Pocet na aktualnej strane" />
        <KpiCard title="Otvorene" value={openCount} hint="Aktualna strana" />
        <KpiCard title="V rieseni" value={reviewCount} hint="Aktualna strana" />
        <KpiCard title="Uzatvorene" value={closedCount} hint="Aktualna strana" />
      </div>

      <Section
        title="Vyhladavanie a filtre"
        subtitle="Hladajte podla ID, nazvu alebo popisu. Status filter podporuje aj nove statusy."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <TextField
            id="owner-disputes-search"
            label="Hladat"
            value={query}
            onChange={setQuery}
            placeholder="ID, nazov, popis"
          />

          <SelectField
            id="owner-disputes-status"
            label="Status"
            value={statusFilter}
            onChange={(value) => {
              setStatusFilter(value);
              setPage(1);
            }}
            options={[
              { value: "all", label: "Vsetky" },
              ...availableStatuses.map((status) => ({
                value: status,
                label: getStatusLabel(status),
              })),
            ]}
          />

          <SelectField
            id="owner-disputes-sort"
            label="Triedenie"
            value={sort}
            onChange={(value) => {
              setSort(value);
              setPage(1);
            }}
            options={[
              { value: "newest", label: "Najnovsie" },
              { value: "oldest", label: "Najstarsie" },
            ]}
          />
        </div>
      </Section>

      <Section title="Zoznam reklamacii" subtitle={`Zobrazene: ${rows.length} z ${total}`}>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            <div>Zatial nic pre zvolene filtre.</div>
            <div className="mt-2 text-sm text-white/50">
              Ak chcete otvorit novu reklamaciu, najprv vyberte rezervaciu.
            </div>
            <div className="mt-3">
              <Link
                href="/owner/reservations"
                className="inline-flex rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
              >
                Ist na rezervacie
              </Link>
            </div>
          </div>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => {
              const reservation = reservationMap[row.reservation_id];
              const titleText = getTitle(row);
              const descriptionText = getDescription(row);

              return (
                <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm text-white/50">Reklamacia</span>
                        <strong className="text-base">#{row.id}</strong>
                      </div>

                      <div className="text-lg font-semibold text-white">{titleText}</div>

                      <div className="text-white/80">
                        <span className="text-white/50">Polozka:</span>{" "}
                        <strong>{itemTitleMap[row.item_id] ?? `#${row.item_id}`}</strong>
                      </div>

                      <div className="text-white/80">
                        <span className="text-white/50">Rezervacia:</span> #{row.reservation_id}
                      </div>

                      {row.dispute_type ? (
                        <div className="text-white/80">
                          <span className="text-white/50">Typ:</span> {getDisputeTypeLabel(row.dispute_type)}
                        </div>
                      ) : null}

                      {reservation ? (
                        <div className="text-white/80">
                          <span className="text-white/50">Termin:</span>{" "}
                          {formatDate(reservation.date_from)} - {formatDate(reservation.date_to)}
                        </div>
                      ) : null}

                      {descriptionText ? (
                        <div className="max-w-3xl whitespace-pre-wrap text-sm text-white/70">
                          {descriptionText}
                        </div>
                      ) : null}

                      <div className="text-sm text-white/50">
                        Vytvorene: {formatDate(row.created_at)} · Aktualizovane: {formatDate(row.updated_at)}
                      </div>
                    </div>

                    <Badge tone={getStatusTone(row.status)}>{getStatusLabel(row.status)}</Badge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/owner/disputes/${row.id}`}
                      className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                    >
                      Detail reklamacie
                    </Link>

                    <Link
                      href="/owner/reservations"
                      className="rounded-xl border border-white/15 px-4 py-2 hover:bg-white/10"
                    >
                      Rezervacie
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

        <div className="mt-4">
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      </Section>
    </main>
  );
}
