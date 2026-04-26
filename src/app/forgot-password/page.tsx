"use client";

import Link from "next/link";
import { useState } from "react";
import { buildAuthCallbackUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabaseClient";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sentEmail, setSentEmail] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setStatus("Posielam odkaz...");

    const normalizedEmail = email.trim();
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: buildAuthCallbackUrl({ next: "/reset-password" }),
    });

    if (error) {
      setStatus("Chyba: " + error.message);
      setSubmitting(false);
      return;
    }

    setSentEmail(normalizedEmail);
    setStatus("");
    setSubmitting(false);
  };

  return (
    <main className="mx-auto max-w-md space-y-6">
      <section className="rentulo-card p-8">
        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
            Rentulo
          </div>

          <h1 className="text-3xl font-semibold">Zabudnute heslo</h1>

          <p className="text-sm leading-6 text-white/70">
            Zadaj e-mail k uctu a posleme ti odkaz na nastavenie noveho hesla.
          </p>
        </div>

        {sentEmail ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Ak ucet pre <strong>{sentEmail}</strong> existuje, poslali sme odkaz na reset hesla.
            Otvor e-mail a pokracuj cez odkaz.
          </div>
        ) : null}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <div className="mb-1 text-sm text-white/80">E-mail</div>
            <input
              className="rentulo-input-light px-3 py-2 placeholder:text-black/50"
              placeholder="napr. tvoj@email.sk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              disabled={submitting || !!sentEmail}
            />
          </label>

          <button
            type="submit"
            className="rentulo-btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50"
            disabled={submitting || !!sentEmail}
          >
            {submitting ? "Posielam odkaz..." : "Poslat odkaz na reset hesla"}
          </button>
        </form>

        {status ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
            {status}
          </div>
        ) : null}
      </section>

      <section className="rentulo-card p-5 text-sm text-white/70">
        <Link href="/login" className="font-medium text-indigo-300 hover:text-indigo-200">
          Spat na prihlasenie
        </Link>
      </section>
    </main>
  );
}
