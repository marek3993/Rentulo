"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { supabase } from "@/lib/supabaseClient";

const protectionHelpHref = "/info/ochrana-depozit-spory";

type ReservationRow = {
  id: number;
  item_id: number;
  date_from: string;
  date_to: string;
  payment_status: string | null;
  payment_provider: string | null;
  payment_due_at: string | null;
  status: string | null;
  rental_amount_snapshot: number | null;
  deposit_amount_snapshot: number | null;
};

type ItemOwnerRow = {
  owner_id: string;
};

type CheckoutResponse = {
  available?: boolean;
  checkoutUrl?: string;
  demo?: boolean;
  error?: string;
  fallback?: boolean;
  live?: boolean;
  reason?: string;
};

const CHECKOUT_REQUEST_TIMEOUT_MS = 12_000;

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);

  if (Number.isNaN(date.getTime())) {
    return dateStr;
  }

  return date.toLocaleString("sk-SK");
}

function formatCurrencyAmount(value: number | null) {
  if (value === null) {
    return "-";
  }

  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
  }).format(value);
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function PaymentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const reservationIdRaw = searchParams.get("reservation_id");
  const reservationId = reservationIdRaw ? Number(reservationIdRaw) : NaN;
  const success = searchParams.get("success") === "1";
  const cancel = searchParams.get("cancel") === "1";

  const [status, setStatus] = useState("Nacitavam platbu...");
  const [reservation, setReservation] = useState<ReservationRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [fallbackMessage, setFallbackMessage] = useState("");
  const launchAttemptedRef = useRef(false);

  const loadReservation = async () => {
    if (!Number.isFinite(reservationId)) {
      return null;
    }

    const { data, error } = await supabase
      .from("reservations")
      .select(
        "id,item_id,date_from,date_to,payment_status,payment_provider,payment_due_at,status,rental_amount_snapshot,deposit_amount_snapshot"
      )
      .eq("id", reservationId)
      .maybeSingle();

    if (error) {
      return null;
    }

    const row = (data ?? null) as ReservationRow | null;
    setReservation(row);
    return row;
  };

  const loadItemOwnerId = async (itemId: number) => {
    const { data, error } = await supabase
      .from("items")
      .select("owner_id")
      .eq("id", itemId)
      .maybeSingle();

    if (error) {
      return null;
    }

    return ((data ?? null) as ItemOwnerRow | null)?.owner_id ?? null;
  };

  const blockOwnItemPayment = (message: string) => {
    setAvailabilityError(message);
    setFallbackMessage("");
    setStatus(message);
  };

  const createCheckout = async (loadingStatus: string) => {
    if (!Number.isFinite(reservationId)) {
      const nextError = "Chyba reservation_id.";
      setAvailabilityError(nextError);
      setStatus(nextError);
      return null;
    }

    setBusy(true);
    setStatus(loadingStatus);
    setAvailabilityError("");
    setFallbackMessage("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        const nextError = "Pre pokracovanie sa musis prihlasit.";
        setAvailabilityError(nextError);
        setStatus(nextError);
        return null;
      }

      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => {
        controller.abort();
      }, CHECKOUT_REQUEST_TIMEOUT_MS);

      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ reservationId }),
        signal: controller.signal,
      }).finally(() => {
        window.clearTimeout(timeoutId);
      });

      const payload = (await response.json().catch(() => null)) as CheckoutResponse | null;

      if (!response.ok) {
        const nextError =
          payload?.error ??
          (response.status === 409
            ? "Zvoleny termin uz nie je volny. Vyber si prosim iny termin."
            : "Nepodarilo sa pripravit platbu.");

        setAvailabilityError(nextError);
        setStatus(nextError);
        return null;
      }

      if (payload?.checkoutUrl) {
        return payload;
      }

      if (payload?.fallback || payload?.demo) {
        const nextMessage =
          "Platobna brana este nie je dokoncene nakonfigurovana. Rezervacia zostava nezaplatena, skus to neskor znova.";
        setFallbackMessage(nextMessage);
        setStatus(nextMessage);
        return payload;
      }

      const nextError = payload?.error ?? "Nepodarilo sa pripravit platbu.";
      setAvailabilityError(nextError);
      setStatus(nextError);
      return null;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        const nextError = "Platobna brana neodpoveda. Skus to prosim znova o chvilu.";
        setAvailabilityError(nextError);
        setStatus(nextError);
        return null;
      }

      const nextError = "Nepodarilo sa pripravit platbu. Skus to znova.";
      setAvailabilityError(nextError);
      setStatus(nextError);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const waitForPaidReservation = async () => {
    setStatus("Platba prebehla. Cakam na potvrdenie webhookom...");

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const nextReservation = await loadReservation();

      if (nextReservation?.payment_status === "paid") {
        setStatus("Platba bola uspesne zaevidovana.");
        window.setTimeout(() => {
          router.replace("/reservations");
        }, 1200);
        return;
      }

      if (nextReservation?.payment_status === "failed") {
        setStatus("Platba sa nepodarila zaevidovat ako uspesna.");
        return;
      }

      await wait(2000);
    }

    setStatus(
      "Platba sa este spracovava. Obnov tuto stranku o chvilu alebo skontroluj Moje rezervacie."
    );
  };

  useEffect(() => {
    let active = true;

    const run = async () => {
      if (!Number.isFinite(reservationId)) {
        if (active) {
          setStatus("Chyba reservation_id.");
        }
        return;
      }

      const row = await loadReservation();

      if (!active) {
        return;
      }

      if (!row) {
        setStatus("Rezervacia neexistuje.");
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const currentUserId = session?.user.id ?? null;

      if (currentUserId) {
        const itemOwnerId = await loadItemOwnerId(row.item_id);

        if (!active) {
          return;
        }

        if (itemOwnerId && itemOwnerId === currentUserId) {
          blockOwnItemPayment("Vlastnu polozku nie je mozne rezervovat ani zaplatit.");
          return;
        }
      }

      if (success) {
        if (row.payment_status === "paid") {
          setStatus("Platba bola uspesne zaevidovana.");
          window.setTimeout(() => {
            router.replace("/reservations");
          }, 1200);
          return;
        }

        void waitForPaidReservation();
        return;
      }

      if (cancel) {
        setStatus("Platba bola zrusena. Rezervacia zostava nezaplatena.");
        return;
      }

      if (row.payment_status === "paid") {
        setStatus("Tato rezervacia je uz zaplatena.");
        return;
      }

      if (row.payment_status === "failed") {
        setStatus("Predosla platba zlyhala alebo expirovala.");
        return;
      }

      if (row.status === "cancelled") {
        setStatus("Tato rezervacia je zrusena.");
        return;
      }

      if (launchAttemptedRef.current) {
        return;
      }

      launchAttemptedRef.current = true;
      const payload = await createCheckout("Presmerovavam na Stripe Checkout...");

      if (!active || !payload?.checkoutUrl) {
        return;
      }

      window.location.assign(payload.checkoutUrl);
    };

    void run();

    return () => {
      active = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancel, reservationId, router, success]);

  const itemDetailHref = useMemo(() => {
    if (!reservation) {
      return null;
    }

    const params = new URLSearchParams();

    if (reservation.date_from) {
      params.set("date_from", reservation.date_from);
    }

    if (reservation.date_to) {
      params.set("date_to", reservation.date_to);
    }

    const query = params.toString();
    return query ? `/items/${reservation.item_id}?${query}` : `/items/${reservation.item_id}`;
  }, [reservation]);

  const showProcessingState =
    success && reservation?.payment_status !== "paid" && reservation?.payment_status !== "failed";

  return (
    <main className="max-w-xl">
      <h1 className="text-2xl font-semibold">Platba</h1>

      <p className="mt-4">
        Rezervacia: <strong>#{reservationIdRaw ?? "-"}</strong>
      </p>

      {reservation?.payment_due_at ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          Platbu treba dokoncit do: {" "}
          <strong className="text-white">{formatDateTime(reservation.payment_due_at)}</strong>
        </div>
      ) : null}

      {reservation ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          <div className="font-semibold text-white">Financny snapshot rezervacie</div>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            <div>
              Prenajom:{" "}
              <strong className="text-white">
                {formatCurrencyAmount(reservation.rental_amount_snapshot)}
              </strong>
            </div>
            <div>
              Depozit:{" "}
              <strong className="text-white">
                {formatCurrencyAmount(reservation.deposit_amount_snapshot)}
              </strong>
            </div>
          </div>
        </div>
      ) : null}

      {reservation ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
          <div className="font-semibold text-white">Ochrana a depozit</div>
          <div className="mt-3 space-y-3">
            <p>
              <strong className="text-white">Ochrana:</strong> Rentulo proces pri probleme pocas
              alebo po prenajme. Pri probleme sa vysledok riesi cez spor a rozhodnutie v systeme.
            </p>
            <p>
              <strong className="text-white">Depozit:</strong> Vidis interny financny udaj
              rezervacie. Automaticke uvolnenie alebo strhnutie penazi tu zatial netvrdime.
            </p>
            <p>
              <strong className="text-white">Spor:</strong> Ak vznikne problem, dalsi postup je v
              reklamacii alebo spore.
            </p>
            <p className="text-white/75">
              Tento blok je iba informacny.{" "}
              <Link
                className="underline underline-offset-2 hover:text-white"
                href={protectionHelpHref}
              >
                Otvor vysvetlenie ochrany, depozitu a sporu
              </Link>
              .
            </p>
          </div>
        </div>
      ) : null}

      {availabilityError ? (
        <div className="mt-4 rounded-2xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-100">
          <div className="font-semibold">Platbu sa nepodarilo pripravit.</div>
          <div className="mt-1">{availabilityError}</div>
        </div>
      ) : null}

      {fallbackMessage ? (
        <div className="mt-4 rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-50">
          <div className="font-semibold">Stripe este nie je aktivny.</div>
          <div className="mt-1">{fallbackMessage}</div>
        </div>
      ) : null}

      {cancel ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/80">
          Platba bola v Stripe zrusena. Rezervacia nebola oznacena ako zaplatena.
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="font-medium">{status}</p>

        {showProcessingState ? (
          <div className="mt-4 text-sm text-white/60">
            Ak sa webhook este nespracoval, stav sa zmeni az po doruceni potvrdenia zo Stripe.
          </div>
        ) : null}

        {!success && !cancel && !fallbackMessage && reservation?.payment_status !== "paid" ? (
          <div className="mt-4 text-sm text-white/70">
            Po priprave checkoutu budes presmerovany na bezpecnu platobnu stranku Stripe.
          </div>
        ) : null}

        {busy ? (
          <div className="mt-4 text-sm text-white/60">Pripravujem checkout...</div>
        ) : null}
      </div>

      <div className="mt-6 flex gap-4">
        {itemDetailHref ? (
          <Link className="underline" href={itemDetailHref}>
            Spat na detail polozky
          </Link>
        ) : (
          <Link className="underline" href="/items">
            Spat na ponuky
          </Link>
        )}
        <Link className="underline" href="/reservations">
          Moje rezervacie
        </Link>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<main className="p-8">Nacitavam platbu...</main>}>
      <PaymentInner />
    </Suspense>
  );
}
