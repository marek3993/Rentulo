"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";
import {
  asRouteRecord,
  asRouteRecords,
  connectReadinessClass,
  connectReadinessLabel,
  formatCurrencyAmount,
  formatDateTime,
  normalizeConnectReadiness,
  normalizePayoutStatus,
  parseLooseNumber,
  payoutStatusClass,
  payoutStatusLabel,
  pickIdentifier,
  pickNumber,
  pickString,
  toInputAmount,
  type RouteRecord,
} from "@/lib/payoutUi";

type AccountProfileResponse = {
  ok?: boolean;
  accountProfile?: unknown;
  connect?: unknown;
  error?: string;
};

type PayoutRequestsResponse = {
  ok?: boolean;
  rows?: unknown;
  total?: number;
  page?: number;
  pageSize?: number;
  error?: string;
};

type CreatePayoutRequestResponse = {
  ok?: boolean;
  payoutRequest?: unknown;
  error?: string;
};

const PAGE_SIZE = 10;

const CURRENCY_KEYS = ["currency", "default_currency", "payout_currency", "account_currency"];
const AVAILABLE_BALANCE_KEYS = [
  "available_balance",
  "available_payout_balance",
  "balance_available",
  "available_amount",
  "payout_available_amount",
  "earnings_available_balance",
];
const PENDING_BALANCE_KEYS = [
  "pending_balance",
  "pending_payout_balance",
  "balance_pending",
  "pending_amount",
  "payout_pending_amount",
  "earnings_pending_balance",
];
const TOTAL_EARNED_KEYS = [
  "total_earned",
  "total_earnings",
  "earned_total",
  "earnings_total",
  "gross_earnings_total",
];
const TOTAL_PAID_OUT_KEYS = [
  "total_paid_out",
  "total_paid",
  "paid_out_total",
  "payouts_total",
  "total_payouts",
  "lifetime_paid_out",
];
const REQUEST_AMOUNT_KEYS = [
  "requested_amount",
  "amount",
  "paid_amount",
  "gross_amount",
  "net_amount",
];
const REQUEST_STATUS_KEYS = ["status", "payout_status", "request_status"];
const REQUEST_ID_KEYS = ["id", "payout_request_id", "request_id"];
const REQUEST_CREATED_AT_KEYS = ["created_at", "requested_at", "inserted_at"];
const REQUEST_UPDATED_AT_KEYS = ["paid_at", "processed_at", "failed_at", "updated_at"];
const REQUEST_NOTE_KEYS = ["note", "admin_note"];
const REQUEST_FAILURE_KEYS = ["failure_reason", "reason"];

function MetricCard({
  title,
  value,
  hint,
}: {
  title: string;
  value: string;
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

export default function EarningsPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("Načítavam...");
  const [requestError, setRequestError] = useState("");
  const [requestSuccess, setRequestSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accountProfile, setAccountProfile] = useState<RouteRecord | null>(null);
  const [connect, setConnect] = useState<RouteRecord | null>(null);
  const [rows, setRows] = useState<RouteRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [amountInput, setAmountInput] = useState("");

  const currency = pickString(accountProfile, CURRENCY_KEYS) ?? "EUR";
  const availableBalance = pickNumber(accountProfile, AVAILABLE_BALANCE_KEYS);
  const pendingBalance = pickNumber(accountProfile, PENDING_BALANCE_KEYS);
  const totalEarned = pickNumber(accountProfile, TOTAL_EARNED_KEYS);
  const totalPaidOut = pickNumber(accountProfile, TOTAL_PAID_OUT_KEYS);
  const connectState = normalizeConnectReadiness(connect);
  const parsedAmount = parseLooseNumber(amountInput);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const payoutRequestHint = useMemo(() => {
    if (availableBalance === null) {
      return "Zostatok na vyplatenie sa zatiaľ nepodarilo načítať.";
    }

    if (availableBalance <= 0) {
      return "Momentálne nie je čo vyplatiť.";
    }

    if (parsedAmount === null || parsedAmount <= 0) {
      return "Zadaj sumu, ktorú chceš poslať na spracovanie.";
    }

    if (parsedAmount > availableBalance) {
      return "Zadaná suma je vyššia ako zostatok na vyplatenie.";
    }

    return `Na spracovanie odošleš ${formatCurrencyAmount(parsedAmount, currency)}.`;
  }, [availableBalance, currency, parsedAmount]);

  const canSubmitRequest =
    availableBalance !== null &&
    availableBalance > 0 &&
    parsedAmount !== null &&
    parsedAmount > 0 &&
    parsedAmount <= availableBalance &&
    !submitting;

  const loadData = async (nextPage: number) => {
    setLoading(true);
    setStatus("Načítavam...");
    setRequestError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const headers = new Headers({
        Authorization: `Bearer ${accessToken}`,
      });

      const [accountProfileResponse, payoutRequestsResponse] = await Promise.all([
        fetch("/api/payment/account-profile", { headers }),
        fetch(`/api/payment/payout-requests?page=${nextPage}&pageSize=${PAGE_SIZE}`, { headers }),
      ]);

      const accountProfilePayload = (await accountProfileResponse
        .json()
        .catch(() => null)) as AccountProfileResponse | null;
      const payoutRequestsPayload = (await payoutRequestsResponse
        .json()
        .catch(() => null)) as PayoutRequestsResponse | null;

      if (!accountProfileResponse.ok || accountProfilePayload?.ok === false) {
        throw new Error(accountProfilePayload?.error || "Nepodarilo sa načítať Zárobky.");
      }

      if (!payoutRequestsResponse.ok || payoutRequestsPayload?.ok === false) {
        throw new Error(payoutRequestsPayload?.error || "Nepodarilo sa načítať Históriu výplat.");
      }

      const nextAccountProfile = asRouteRecord(accountProfilePayload?.accountProfile ?? null);
      const nextAvailableBalance = pickNumber(nextAccountProfile, AVAILABLE_BALANCE_KEYS);

      setAccountProfile(nextAccountProfile);
      setConnect(asRouteRecord(accountProfilePayload?.connect ?? null));
      setRows(asRouteRecords(payoutRequestsPayload?.rows ?? []));
      setTotal(typeof payoutRequestsPayload?.total === "number" ? payoutRequestsPayload.total : 0);
      setPage(typeof payoutRequestsPayload?.page === "number" ? payoutRequestsPayload.page : nextPage);
      setStatus("");

      setAmountInput((current) => {
        if (current.trim()) {
          return current;
        }

        if (nextAvailableBalance !== null && nextAvailableBalance > 0) {
          return toInputAmount(nextAvailableBalance);
        }

        return "";
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Nepodarilo sa načítať Zárobky.";
      setStatus("Chyba: " + message);
    } finally {
      setLoading(false);
      setAuthChecked(true);
    }
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!active) {
        return;
      }

      await loadData(page);
    };

    void run();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, router]);

  const submitPayoutRequest = async () => {
    if (!canSubmitRequest || parsedAmount === null) {
      return;
    }

    setSubmitting(true);
    setRequestError("");
    setRequestSuccess("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/payment/payout-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount: parsedAmount,
          currency,
        }),
      });

      const payload = (await response.json().catch(() => null)) as CreatePayoutRequestResponse | null;

      if (!response.ok || payload?.ok === false) {
        throw new Error(payload?.error || "Nepodarilo sa odoslať žiadosť o výplatu.");
      }

      setRequestSuccess("Žiadosť o výplatu bola odoslaná.");
      setAmountInput("");
      await loadData(1);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Nepodarilo sa odoslať žiadosť o výplatu.";
      setRequestError(message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!authChecked && loading) {
    return (
      <main className="space-y-6">
        <div className="rentulo-card p-6">Načítavam...</div>
      </main>
    );
  }

  return (
    <main className="space-y-6">
      <section className="rentulo-card p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="max-w-2xl">
            <div className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-300">
              Zárobky
            </div>

            <h1 className="mt-4 text-3xl font-semibold md:text-4xl">Zárobky a Výplaty</h1>

            <p className="mt-2 leading-7 text-white/70">
              Prehľad zostatku na vyplatenie, žiadostí o výplatu a histórie ich spracovania.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link href="/profile" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Späť na profil
            </Link>
            <Link href="/owner/reservations" className="rentulo-btn-secondary px-4 py-2.5 text-sm">
              Moje rezervácie
            </Link>
          </div>
        </div>
      </section>

      {status ? <div className="rentulo-card p-4 text-white/80">{status}</div> : null}

      {requestError ? (
        <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="font-semibold">Žiadosť sa nepodarilo odoslať.</div>
          <div className="mt-1">{requestError}</div>
        </div>
      ) : null}

      {requestSuccess ? (
        <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
          <div className="font-semibold">Výplata bola odoslaná na spracovanie.</div>
          <div className="mt-1">{requestSuccess}</div>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Zostatok na vyplatenie"
          value={formatCurrencyAmount(availableBalance, currency)}
          hint="Suma pripravená na odoslanie žiadosti."
        />
        <MetricCard
          title="Čaká na uvoľnenie"
          value={formatCurrencyAmount(pendingBalance, currency)}
          hint="Suma, ktorá ešte nie je pripravená na výplatu."
        />
        <MetricCard
          title="Zárobky spolu"
          value={formatCurrencyAmount(totalEarned, currency)}
          hint="Všetky doteraz zaevidované zárobky."
        />
        <MetricCard
          title="Vyplatené spolu"
          value={formatCurrencyAmount(totalPaidOut, currency)}
          hint="Suma, ktorá už bola označená ako vyplatená."
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr,1fr]">
        <div className="rentulo-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <h2 className="text-xl font-semibold">Výplaty</h2>
              <p className="mt-2 text-sm leading-6 text-white/65">
                Odošli žiadosť o výplatu zo sumy, ktorá je pripravená na spracovanie.
              </p>
            </div>

            <div
              className={`rounded-full border px-3 py-1 text-sm font-medium ${connectReadinessClass(
                connectState
              )}`}
            >
              Prijímanie výplat: {connectReadinessLabel(connectState)}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <label className="block">
              <div className="mb-1 text-sm text-white/80">Suma</div>
              <input
                className="rentulo-input-light w-full px-3 py-2"
                inputMode="decimal"
                placeholder="napr. 125,50"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
              />
            </label>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
              {payoutRequestHint}
            </div>

            <button
              type="button"
              className="rentulo-btn-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!canSubmitRequest}
              onClick={submitPayoutRequest}
            >
              {submitting ? "Odosielam..." : "Požiadať o výplatu"}
            </button>
          </div>
        </div>

        <div className="rentulo-card p-6">
          <h2 className="text-xl font-semibold">Stav výplat</h2>
          <div className="mt-4 space-y-3 text-sm text-white/70">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              Žiadosti sa v tejto fáze spracúvajú ručne. Po odoslaní uvidíš stav priamo v Histórii
              výplat.
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              Ak zostatok na vyplatenie chýba alebo je nulový, nové žiadosti sa neodošlú.
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              Samotné spracovanie výplat vykonáva administrácia po kontrole žiadosti.
            </div>
          </div>
        </div>
      </section>

      <section className="rentulo-card p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">História výplat</h2>
            <p className="mt-1 text-sm text-white/60">
              Zobrazuje iba reálne odoslané žiadosti o výplatu.
            </p>
          </div>

          <div className="text-sm text-white/50">
            Spolu <strong className="text-white">{total}</strong>
          </div>
        </div>

        {rows.length === 0 && !loading ? (
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-5 text-white/60">
            Zatiaľ nemáš žiadne žiadosti o výplatu.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {rows.map((row) => {
              const statusValue = normalizePayoutStatus(pickString(row, REQUEST_STATUS_KEYS));
              const requestId = pickIdentifier(row, REQUEST_ID_KEYS) ?? "—";
              const amount = pickNumber(row, REQUEST_AMOUNT_KEYS);
              const createdAt = pickString(row, REQUEST_CREATED_AT_KEYS);
              const updatedAt = pickString(row, REQUEST_UPDATED_AT_KEYS);
              const note = pickString(row, REQUEST_NOTE_KEYS);
              const failureReason = pickString(row, REQUEST_FAILURE_KEYS);

              return (
                <article
                  key={requestId}
                  className="rounded-2xl border border-white/10 bg-black/20 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-white/45">
                        Žiadosť #{requestId}
                      </div>
                      <div className="mt-2 text-xl font-semibold">
                        {formatCurrencyAmount(amount, currency)}
                      </div>
                    </div>

                    <div
                      className={`rounded-full border px-3 py-1 text-sm font-medium ${payoutStatusClass(
                        statusValue
                      )}`}
                    >
                      {payoutStatusLabel(statusValue)}
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 text-sm text-white/65 md:grid-cols-2">
                    <div>
                      <div className="text-white/45">Vytvorené</div>
                      <div className="mt-1 text-white/80">{formatDateTime(createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-white/45">Posledná zmena</div>
                      <div className="mt-1 text-white/80">{formatDateTime(updatedAt)}</div>
                    </div>
                  </div>

                  {note ? (
                    <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/70">
                      Poznámka: {note}
                    </div>
                  ) : null}

                  {failureReason ? (
                    <div className="mt-3 rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">
                      Dôvod: {failureReason}
                    </div>
                  ) : null}
                </article>
              );
            })}
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
                disabled={page <= 1 || loading}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Predchádzajúca
              </button>
              <button
                type="button"
                className="rentulo-btn-secondary px-3 py-2 text-sm disabled:opacity-50"
                disabled={page >= totalPages || loading}
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
