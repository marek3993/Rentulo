"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

function PaymentInner() {
  const sp = useSearchParams();
  const reservationId = sp.get("reservation_id");
  const [status, setStatus] = useState("Preparing payment...");

  useEffect(() => {
    const run = async () => {
      if (!reservationId) {
        setStatus("Missing reservation_id.");
        return;
      }

      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservation_id: Number(reservationId) }),
        });

        if (res.status === 501) {
          setStatus("Payments are not enabled yet (Stripe not configured).");
          return;
        }

        const json = await res.json();

        if (json?.url) {
          window.location.href = json.url;
          return;
        }

        setStatus("Payment error: invalid response.");
      } catch {
        setStatus("Payment error: network.");
      }
    };

    run();
  }, [reservationId]);

  return (
    <main className="p-8 max-w-xl">
      <h1 className="text-2xl font-semibold">Payment</h1>

      <p className="mt-4">
        Reservation: <strong>#{reservationId ?? "-"}</strong>
      </p>

      <div className="mt-4 rounded border p-4">
        <p className="font-medium">{status}</p>
        <p className="mt-2 opacity-80">
          When Stripe keys are added, this page will redirect to Checkout automatically.
        </p>
      </div>

      <div className="mt-6 flex gap-4">
        <Link className="underline" href="/items">
          Back to items
        </Link>
        <Link className="underline" href="/reservations">
          My reservations
        </Link>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<main className="p-8">Loading payment...</main>}>
      <PaymentInner />
    </Suspense>
  );
}
