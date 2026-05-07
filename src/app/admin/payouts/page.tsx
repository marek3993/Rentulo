"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { adminApiFetch } from "@/lib/adminApiClient";
import {
  asRouteRecords,
  formatCurrencyAmount,
  formatDateTime,
  normalizePayoutStatus,
  payoutStatusClass,
  payoutStatusLabel,
  pickIdentifier,
  pickNumber,
  pickString,
  type RouteRecord,
} from "@/lib/payoutUi";

type AdminPayoutRequestsResponse = {
  rows?: unknown;
  total?: number;
  page?: number;
  pageSize?: number;
};

type AdminPayoutActionResponse = {
  payoutRequest?: unknown;
};

const PAGE_SIZE = 20;
const STATUS_KEYS = ["status", "payout_status", "request_status"];
const REQUEST_ID_KEYS = ["id", "payout_request_id", "request_id"];
const USER_ID_KEYS = ["user_id", "owner_id", "profile_id"];
const AMOUNT_KEYS = ["requested_amount", "amount", "paid_amount", "gross_amount", "net_amount"];
const CURRENCY_KEYS = ["currency", "requested_currency", "payout_currency"];
const NOTE_KEYS = ["note", "admin_note"];
const FAILURE_REASON_KEYS = ["failure_reason", "reason"];
const PROVIDER_REF_KEYS = ["provider_ref", "external_ref"];
const CREATED_AT_KEYS = ["created_at", "requested_at", "inserted_at"];
const UPDATED_AT_KEYS = ["paid_at", "processed_at", "failed_at", "updated_at"];

type PayoutStatusSummary = Record<ReturnType<typeof normalizePayoutStatus>, number>;

function SummaryCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: number;
  hint: string;
}) {
  return (
    <div className="rentulo-card p-5">
      <div className="text-sm text-white/60">{title}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
      <div className="mt-1 text-sm text-white/50">{hint}</div>
    </div>
  );
}

export default function AdminPayoutsPage() {
  const [status, setStatus] = useState("Načítavam...");
  const [rows, setRows] = useState<RouteRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busyAction, setBusyAction] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const counts = useMemo(() => {
    const initialSummary: PayoutStatusSummary = {
      pending: 0,
      processing: 0,
      paid: 0,
      failed: 0,
      unknown: 0,
    };

    return rows.reduce<PayoutStatusSummary>(
      (summary, row) => {
        const nextStatus = normalizePayoutStatus(pickString(row, STATUS_KEYS));
        summary[nextStatus] += 1;
        return summary;
      },
      initialSummary
    );
  }, [rows]);

  const load = async (nextPage = page) => {
    setStatus("Načítavam...");
    setActionError("");

    try {
      const response = await adminApiFetch<AdminPayoutRequestsResponse>(
        `/api/admin/payment/payout-requests?page=${nextPage}&pageSize=${PAGE_SIZE}`
      );

      setRows(asRouteRecords(response.rows ?? []));
      setTotal(typeof response.total === "number" ? response.total : 0);
      setPage(typeof response.page === "number" ? response.page : nextPage);
      setStatus("");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo sa načítať žiadosti o výplatu.";
      setStatus("Chyba: " + message);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const runAction = async (row: RouteRecord, action: "processing" | "paid" | "failed") => {
    const requestId = pickIdentifier(row, REQUEST_ID_KEYS);

    if (!requestId) {
      setActionError("Chýba identifikátor žiadosti.");
      return;
    }

    const actionLabels = {
      processing: "označiť ako spracúva sa",
      paid: "označiť ako vyplatené",
      failed: "označiť ako neúspešné",
    } as const;

    const confirmed = window.confirm(
      `Naozaj chceš žiadosť #${requestId} ${actionLabels[action]}?`
    );

    if (!confirmed) {
      return;
    }

    setBusyAction(`${requestId}:${action}`);
    setActionError("");
    setActionSuccess("");

    try {
      const body =
        action === "paid"
          ? {
              paidAt: new Date().toISOString(),
            }
          : {};

      const response = await adminApiFetch<AdminPayoutActionResponse>(
        `/api/admin/payment/payout-requests/${requestId}/${action}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        }
      );

      const updatedRow = response.payoutRequest ? (response.payoutRequest as RouteRecord) : null;

      if (updatedRow) {
        setRows((currentRows) =>
          currentRows.map((currentRow) => {
            const currentId = pickIdentifier(currentRow, REQUEST_ID_KEYS);
            return currentId === requestId ? updatedRow : currentRow;
          })
        );
      } else {
        await load(page);
      }

      setActionSuccess(`Žiadosť #${requestId} bola aktualizovaná.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo sa zmeniť stav žiadosti.";
      setActionError(message);
    } finally {
      setBusyAction("");
    }
  };

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
              Rentulo administrácia
            </div>

            <h1 className="mt-4 text-3xl font-semibold">Front výplat</h1>

            <p className="mt-2 leading-7 text-white/70">
              Prehľad žiadostí o výplatu a ich ručné spracovanie bez automatického odosielania.
            </p>
          </div>

          <Link href="/admin" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
            Späť do administrácie
          </Link>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      {actionError ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="font-semibold">Zmena stavu zlyhala.</div>
          <div className="mt-1">{actionError}</div>
        </div>
      ) : null}

      {actionSuccess ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <div className="font-semibold">Stav výplaty bol uložený.</div>
          <div className="mt-1">{actionSuccess}</div>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard title="Čakajúce" value={counts.pending} hint="Na aktuálnej strane" />
        <SummaryCard title="Spracúva sa" value={counts.processing} hint="Na aktuálnej strane" />
        <SummaryCard title="Vyplatené" value={counts.paid} hint="Na aktuálnej strane" />
        <SummaryCard title="Neúspešné" value={counts.failed} hint="Na aktuálnej strane" />
      </section>

      <section className="rentulo-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Žiadosti o výplatu</h2>
            <p className="mt-1 text-sm text-white/60">
              Zoznam zobrazuje iba reálne odoslané žiadosti o výplatu.
            </p>
          </div>

          <div className="text-sm text-white/50">
            Spolu <strong className="text-white">{total}</strong>
          </div>
        </div>

        {rows.length === 0 && !status ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
            Zatiaľ bez žiadostí o výplatu.
          </div>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-white/55">
                  <th className="border-b border-white/10 px-4 py-3 font-medium">Žiadosť</th>
                  <th className="border-b border-white/10 px-4 py-3 font-medium">Používateľ</th>
                  <th className="border-b border-white/10 px-4 py-3 font-medium">Suma</th>
                  <th className="border-b border-white/10 px-4 py-3 font-medium">Stav</th>
                  <th className="border-b border-white/10 px-4 py-3 font-medium">Detaily</th>
                  <th className="border-b border-white/10 px-4 py-3 font-medium">Akcie</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const requestId = pickIdentifier(row, REQUEST_ID_KEYS) ?? "—";
                  const userId = pickIdentifier(row, USER_ID_KEYS) ?? "—";
                  const amount = pickNumber(row, AMOUNT_KEYS);
                  const currency = pickString(row, CURRENCY_KEYS) ?? "EUR";
                  const statusValue = normalizePayoutStatus(pickString(row, STATUS_KEYS));
                  const createdAt = pickString(row, CREATED_AT_KEYS);
                  const updatedAt = pickString(row, UPDATED_AT_KEYS);
                  const note = pickString(row, NOTE_KEYS);
                  const failureReason = pickString(row, FAILURE_REASON_KEYS);
                  const providerRef = pickString(row, PROVIDER_REF_KEYS);
                  const currentActionKey = `${requestId}:`;
                  const isBusy = busyAction.startsWith(currentActionKey);

                  return (
                    <tr key={requestId} className="align-top">
                      <td className="border-b border-white/10 px-4 py-4 text-white/80">
                        #{requestId}
                      </td>
                      <td className="border-b border-white/10 px-4 py-4 text-white/70">
                        <div className="max-w-[16rem] break-all">{userId}</div>
                      </td>
                      <td className="border-b border-white/10 px-4 py-4 text-white/90">
                        {formatCurrencyAmount(amount, currency)}
                      </td>
                      <td className="border-b border-white/10 px-4 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 font-medium ${payoutStatusClass(
                            statusValue
                          )}`}
                        >
                          {payoutStatusLabel(statusValue)}
                        </span>
                      </td>
                      <td className="border-b border-white/10 px-4 py-4 text-white/65">
                        <div>Vytvorené: {formatDateTime(createdAt)}</div>
                        <div className="mt-1">Posledná zmena: {formatDateTime(updatedAt)}</div>
                        {providerRef ? <div className="mt-1">Referencie: {providerRef}</div> : null}
                        {note ? <div className="mt-2">Poznámka: {note}</div> : null}
                        {failureReason ? (
                          <div className="mt-2 text-red-200">Dôvod: {failureReason}</div>
                        ) : null}
                      </td>
                      <td className="border-b border-white/10 px-4 py-4">
                        <div className="flex min-w-[14rem] flex-col gap-2">
                          <button
                            type="button"
                            className="rentulo-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                            disabled={isBusy || statusValue === "processing" || statusValue === "paid"}
                            onClick={() => runAction(row, "processing")}
                          >
                            {busyAction === `${requestId}:processing`
                              ? "Ukladám..."
                              : "Označiť ako spracúva sa"}
                          </button>
                          <button
                            type="button"
                            className="rentulo-btn-primary px-3 py-2 text-sm disabled:opacity-50"
                            disabled={isBusy || statusValue === "paid"}
                            onClick={() => runAction(row, "paid")}
                          >
                            {busyAction === `${requestId}:paid`
                              ? "Ukladám..."
                              : "Označiť ako vyplatené"}
                          </button>
                          <button
                            type="button"
                            className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100 transition hover:bg-red-500/15 disabled:opacity-50"
                            disabled={isBusy || statusValue === "failed" || statusValue === "paid"}
                            onClick={() => runAction(row, "failed")}
                          >
                            {busyAction === `${requestId}:failed`
                              ? "Ukladám..."
                              : "Označiť ako neúspešné"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {total > PAGE_SIZE ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-white/60">
              Strana <strong className="text-white">{page}</strong> z{" "}
              <strong className="text-white">{totalPages}</strong>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="rentulo-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                disabled={page <= 1 || Boolean(status)}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Predchádzajúca
              </button>
              <button
                type="button"
                className="rentulo-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                disabled={page >= totalPages || Boolean(status)}
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              >
                Ďalšia
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
