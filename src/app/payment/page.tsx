"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

function PaymentInner() {
  const sp = useSearchParams();
  const router = useRouter();

  const reservationIdRaw = sp.get("reservation_id");
  const reservationId = reservationIdRaw ? Number(reservationIdRaw) : NaN;

  const [status, setStatus] = useState("Pripravujem platbu...");
  const [mode, setMode] = useState<"loading" | "stripe" | "demo">("loading");

  useEffect(() => {
    const run = async () => {
      if (!Number.isFinite(reservationId)) {
        setStatus("Chýba reservation_id.");
        setMode("demo");
        return;
      }

      // Skús checkout (ak Stripe nie je, API vráti 501 -> demo)
      try {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reservation_id: reservationId }),
        });

        if (res.status === 501) {
          setStatus("Demo režim: Stripe nie je nastavený.");
          setMode("demo");
          return;
        }

        const json = await res.json();

        if (json?.url) {
          setMode("stripe");
          window.location.href = json.url;
          return;
        }

        setStatus("Chyba platby: neplatná odpoveď.");
        setMode("demo");
      } catch {
        setStatus("Demo režim: platobná brána nie je dostupná.");
        setMode("demo");
      }
    };

    run();
  }, [reservationId]);

  const markPaidDemo = async () => {
    if (!Number.isFinite(reservationId)) return;

    setStatus("Označujem ako zaplatené (demo)...");

    const { data: sess } = await supabase.auth.getSession();
    const userId = sess.session?.user.id;

    if (!userId) {
      router.push("/login");
      return;
    }

    const { error } = await supabase
      .from("reservations")
      .update({
        payment_provider: "demo",
        payment_status: "paid",
      })
      .eq("id", reservationId)
      .eq("renter_id", userId);

    if (error) {
      setStatus("Chyba: " + error.message);
      return;
    }

    setStatus("Platba úspešná ✅ (demo)");
    router.push("/reservations");
  };

  return (
    <main className="max-w-xl">
      <h1 className="text-2xl font-semibold">Platba</h1>

      <p className="mt-4">
        Rezervácia: <strong>#{reservationIdRaw ?? "-"}</strong>
      </p>

      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-6">
        <p className="font-medium">{status}</p>

        {mode === "demo" ? (
          <div className="mt-4 space-y-3">
            <div className="text-white/70 text-sm">
              Toto je testovací režim. Neskôr sa tu napojí Stripe a stránka bude presmerovávať na reálnu platbu.
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className="rounded bg-white px-4 py-2 font-medium text-black hover:bg-white/90"
                onClick={markPaidDemo}
                type="button"
              >
                Simulovať úspešnú platbu
              </button>

              <button
                className="rounded border border-white/15 px-4 py-2 hover:bg-white/10"
                onClick={() => setStatus("Platba zlyhala (demo).")}
                type="button"
              >
                Simulovať zlyhanie
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mt-6 flex gap-4">
        <Link className="underline" href="/items">
          Späť na ponuky
        </Link>
        <Link className="underline" href="/reservations">
          Moje rezervácie
        </Link>
      </div>
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense fallback={<main className="p-8">Načítavam platbu…</main>}>
      <PaymentInner />
    </Suspense>
  );
}