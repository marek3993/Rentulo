"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const router = useRouter();
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState("Overujem odkaz...");
  const [ready, setReady] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!active) return;

      setSessionReady(!!session);
      setReady(true);
      setStatus(session ? "" : "Odkaz na reset hesla je neplatny alebo uz vyprsal.");
    };

    void loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setSessionReady(!!session);
      setReady(true);

      if (session) {
        setStatus("");
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();

      if (redirectTimerRef.current) {
        clearTimeout(redirectTimerRef.current);
      }
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setStatus("Heslo musi mat aspon 6 znakov.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("Hesla sa nezhoduju.");
      return;
    }

    setSubmitting(true);
    setStatus("Ukladam nove heslo...");

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setStatus("Chyba: " + error.message);
      setSubmitting(false);
      return;
    }

    setStatus("Heslo bolo zmenene. Presmerovavam ta do aplikacie...");
    redirectTimerRef.current = setTimeout(() => {
      router.replace("/");
      router.refresh();
    }, 1200);
  };

  return (
    <main className="mx-auto max-w-md space-y-6">
      <section className="rentulo-card p-8">
        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
            Rentulo
          </div>

          <h1 className="text-3xl font-semibold">Nove heslo</h1>

          <p className="text-sm leading-6 text-white/70">
            Nastav si nove heslo pre svoj ucet.
          </p>
        </div>

        {ready && !sessionReady ? (
          <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {status}
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <div className="mb-1 text-sm text-white/80">Nove heslo</div>
            <input
              className="rentulo-input-light px-3 py-2 placeholder:text-black/50"
              placeholder="Minimalne 6 znakov"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={6}
              required
              disabled={!sessionReady || submitting}
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm text-white/80">Potvrdit nove heslo</div>
            <input
              className="rentulo-input-light px-3 py-2 placeholder:text-black/50"
              placeholder="Zopakuj nove heslo"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              minLength={6}
              required
              disabled={!sessionReady || submitting}
            />
          </label>

          <button
            type="submit"
            className="rentulo-btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50"
            disabled={!sessionReady || submitting}
          >
            {submitting ? "Ukladam..." : "Ulozit nove heslo"}
          </button>
        </form>

        {status && (!ready || sessionReady) ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
            {status}
          </div>
        ) : null}
      </section>

      <section className="rentulo-card p-5 text-sm text-white/70">
        <Link
          href={sessionReady ? "/" : "/forgot-password"}
          className="font-medium text-indigo-300 hover:text-indigo-200"
        >
          {sessionReady ? "Spat do aplikacie" : "Vyziadat novy reset link"}
        </Link>
      </section>
    </main>
  );
}
