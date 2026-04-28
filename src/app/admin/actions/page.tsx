"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/adminApiClient";

type ActionRow = {
  id: number;
  action_type: string;
  target_table: string | null;
  target_id: string | null;
  created_at: string;
};

type ActionsResponse = {
  rows: ActionRow[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 20;

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return date.toLocaleString("sk-SK");
}

function actionLabel(actionType: string) {
  if (actionType === "verification_status_changed") return "Zmena stavu overenia";
  if (actionType === "user_role_changed") return "Zmena roly pouzivatela";
  if (actionType === "user_suspended") return "Pouzivatel pozastaveny";
  if (actionType === "user_blocked") return "Pouzivatel zablokovany";
  if (actionType === "user_active") return "Pouzivatel obnoveny";
  if (actionType === "user_soft_deleted") return "Pouzivatel soft deleted";
  if (actionType === "item_hidden") return "Inzerat skryty";
  if (actionType === "item_visibility_restored") return "Inzerat znovu viditelny";
  if (actionType === "review_hidden") return "Hodnotenie skryte";
  if (actionType === "review_restored") return "Hodnotenie obnovene";
  if (actionType === "review_deleted") return "Hodnotenie vymazane";
  if (actionType === "wallet_release") return "Uvolnenie payoutu";
  if (actionType === "dispute_status_changed") return "Zmena stavu sporu";
  return actionType;
}

export default function AdminActionsPage() {
  const [status, setStatus] = useState("Nacitavam...");
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const itemActions = useMemo(
    () => rows.filter((row) => row.target_table === "items").length,
    [rows]
  );
  const userActions = useMemo(
    () => rows.filter((row) => row.target_table === "profiles").length,
    [rows]
  );
  const reviewActions = useMemo(
    () => rows.filter((row) => row.target_table === "reviews").length,
    [rows]
  );

  const load = async (nextPage = page) => {
    setStatus("Nacitavam...");

    try {
      const response = await adminApiFetch<ActionsResponse>(`/api/admin/actions?page=${nextPage}`);
      setRows(response.rows);
      setTotal(response.total);
      setPage(response.page);
      setStatus("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepodarilo sa nacitat audit.";
      setStatus("Chyba: " + message);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo administracia
            </div>

            <h1 className="mt-4 text-3xl font-semibold">Admin audit</h1>

            <p className="mt-2 leading-7 text-white/70">
              Realny audit log citany z existujucej tabulky admin_actions.
            </p>
          </div>

          <Link href="/admin" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
            Spat do administracie
          </Link>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      <section className="grid gap-4 md:grid-cols-4">
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Zaznamy</div>
          <div className="mt-2 text-3xl font-semibold">{rows.length}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">User akcie</div>
          <div className="mt-2 text-3xl font-semibold">{userActions}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Item akcie</div>
          <div className="mt-2 text-3xl font-semibold">{itemActions}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>
        <div className="rentulo-card p-5">
          <div className="text-sm text-white/60">Review akcie</div>
          <div className="mt-2 text-3xl font-semibold">{reviewActions}</div>
          <div className="mt-1 text-sm text-white/50">Na aktualnej strane</div>
        </div>
      </section>

      <section className="rentulo-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Historia zasahov</h2>
          <p className="mt-1 text-sm text-white/60">
            Zobrazuje existujuce zapisane akcie z backend auditu.
          </p>
        </div>

        {rows.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-4 text-white/60">
            Zatial bez audit zaznamov.
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((row) => (
              <li key={row.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{actionLabel(row.action_type)}</div>
                    <div className="mt-1 text-sm text-white/60">
                      {row.target_table || "-"} / {row.target_id || "-"}
                    </div>
                  </div>

                  <div className="text-sm text-white/50">{formatDate(row.created_at)}</div>
                </div>
              </li>
            ))}
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
