"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/adminApiClient";

type ReviewRow = {
  id: number;
  reservation_id: number;
  item_id: number | null;
  item_title: string | null;
  reviewer_id: string;
  reviewer_name: string | null;
  reviewee_id: string;
  reviewee_name: string | null;
  base_type: string;
  visibility: "visible" | "hidden";
  reviewee_type: string;
  rating: number;
  comment: string | null;
  created_at: string;
};

type ReviewsResponse = {
  rows: ReviewRow[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 12;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("sk-SK");
}

function visibilityBadge(visibility: ReviewRow["visibility"]) {
  if (visibility === "hidden") {
    return "bg-amber-500/15 text-amber-300";
  }

  return "bg-emerald-500/15 text-emerald-300";
}

function visibilityLabel(visibility: ReviewRow["visibility"]) {
  return visibility === "hidden" ? "Skryte" : "Verejne";
}

export default function AdminReviewsPage() {
  const [status, setStatus] = useState("Nacitavam...");
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const visibleCount = useMemo(
    () => rows.filter((row) => row.visibility === "visible").length,
    [rows]
  );
  const hiddenCount = useMemo(
    () => rows.filter((row) => row.visibility === "hidden").length,
    [rows]
  );

  const load = async (nextPage = page, nextQuery = query.trim()) => {
    setStatus("Nacitavam...");

    try {
      const searchParams = new URLSearchParams({
        page: String(nextPage),
        q: nextQuery,
        visibility: visibilityFilter,
      });

      const response = await adminApiFetch<ReviewsResponse>(`/api/admin/reviews?${searchParams}`);
      setRows(response.rows);
      setTotal(response.total);
      setPage(response.page);
      setStatus("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepodarilo sa nacitat hodnotenia.";
      setStatus("Chyba: " + message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, visibilityFilter]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      load(1, query.trim());
    }, 250);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const setVisibility = async (reviewId: number, visibility: "visible" | "hidden") => {
    setUpdatingId(reviewId);
    setStatus("Ukladam moderaciu...");

    try {
      await adminApiFetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          action: "set_visibility",
          visibility,
        }),
      });

      setStatus(visibility === "hidden" ? "Hodnotenie bolo skryte." : "Hodnotenie bolo obnovene.");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Moderacia zlyhala.";
      setStatus("Chyba: " + message);
    } finally {
      setUpdatingId(null);
    }
  };

  const deleteReview = async (reviewId: number) => {
    const confirmed = window.confirm(
      "Toto je natrvale vymazanie. Pouzi len ked skrytie nestaci. Pokracovat?"
    );

    if (!confirmed) {
      return;
    }

    setUpdatingId(reviewId);
    setStatus("Mazem hodnotenie...");

    try {
      await adminApiFetch(`/api/admin/reviews/${reviewId}`, {
        method: "DELETE",
      });

      setStatus("Hodnotenie bolo natrvalo vymazane.");
      await load();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Mazanie zlyhalo.";
      setStatus("Chyba: " + message);
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo administracia
            </div>

            <h1 className="mt-4 text-3xl font-semibold">Moderacia hodnoteni</h1>

            <p className="mt-2 leading-7 text-white/70">
              Minimalne rozumne riesenie: skryt, obnovit a az potom pripadne natrvalo vymazat.
            </p>
          </div>

          <Link href="/admin" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
            Spat do administracie
          </Link>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Zobrazene</div>
          <div className="mt-2 text-3xl font-semibold">{rows.length}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Verejne</div>
          <div className="mt-2 text-3xl font-semibold">{visibleCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Skryte</div>
          <div className="mt-2 text-3xl font-semibold">{hiddenCount}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>
      </section>

      <section className="rentulo-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Queue a filtre</h2>
          <p className="mt-1 text-sm text-white/60">
            Hladaj podla itemu, komentara, rezervacie alebo identity pouzivatela.
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div>
            <label htmlFor="admin-reviews-search" className="block text-sm text-white/70">
              Hladat
            </label>
            <input
              id="admin-reviews-search"
              className="rentulo-input-dark mt-2 px-3 py-2 placeholder:text-white/40"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Item, komentar, reservation ID, reviewer"
            />
          </div>

          <div>
            <label htmlFor="admin-reviews-visibility" className="block text-sm text-white/70">
              Viditelnost
            </label>
            <select
              id="admin-reviews-visibility"
              className="rentulo-input-dark mt-2 px-3 py-2"
              value={visibilityFilter}
              onChange={(event) => {
                setVisibilityFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Vsetky</option>
              <option value="visible">Len verejne</option>
              <option value="hidden">Len skryte</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rentulo-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Hodnotenia</h2>
          <p className="mt-1 text-sm text-white/60">
            Zobrazene: {rows.length} z {total}
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Ziadne hodnotenia pre zvolene filtre.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => {
              const isBusy = updatingId === row.id;

              return (
                <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <strong className="text-base">#{row.id}</strong>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${visibilityBadge(
                            row.visibility
                          )}`}
                        >
                          {visibilityLabel(row.visibility)}
                        </span>
                        <span className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-white/75">
                          {row.base_type === "item" ? "Hodnotenie veci" : "Hodnotenie prenajimatela"}
                        </span>
                      </div>

                      <div className="text-white/90">
                        <strong>{row.rating} / 5</strong>
                        {row.item_title ? <span className="text-white/60"> · {row.item_title}</span> : null}
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">Reviewer:</span>{" "}
                        {row.reviewer_name || row.reviewer_id}
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">Reviewee:</span>{" "}
                        {row.reviewee_name || row.reviewee_id}
                      </div>

                      <div className="text-white/75">
                        <span className="text-white/50">Reservation:</span> {row.reservation_id}
                      </div>

                      <div className="text-sm text-white/50">{formatDate(row.created_at)}</div>

                      <div className="max-w-3xl whitespace-pre-wrap text-sm leading-6 text-white/75">
                        {row.comment?.trim() || "Bez komentara"}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {row.visibility === "visible" ? (
                        <button
                          type="button"
                          className="rentulo-btn-secondary px-4 py-2 text-sm disabled:opacity-50"
                          onClick={() => setVisibility(row.id, "hidden")}
                          disabled={isBusy}
                        >
                          {isBusy ? "Ukladam..." : "Skryt"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="rentulo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                          onClick={() => setVisibility(row.id, "visible")}
                          disabled={isBusy}
                        >
                          {isBusy ? "Ukladam..." : "Obnovit"}
                        </button>
                      )}

                      {row.item_id ? (
                        <Link href={`/items/${row.item_id}`} className="rentulo-btn-secondary px-4 py-2 text-sm">
                          Item detail
                        </Link>
                      ) : null}

                      <button
                        type="button"
                        className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-200 disabled:opacity-50"
                        onClick={() => deleteReview(row.id)}
                        disabled={isBusy}
                      >
                        {isBusy ? "Mazem..." : "Vymazat natrvalo"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {total > PAGE_SIZE ? (
          <div className="mt-4 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-white/60">
              Strana <strong className="text-white">{page}</strong> z{" "}
              <strong className="text-white">{totalPages}</strong> · Spolu{" "}
              <strong className="text-white">{total}</strong>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="rentulo-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                ← Predchadzajuca
              </button>

              <button
                type="button"
                className="rentulo-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
              >
                Dalsia →
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
