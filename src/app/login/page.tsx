"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setStatus("Prihlasujem...");

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStatus("Chyba: " + error.message);
      setSubmitting(false);
      return;
    }

    setStatus("Prihlásenie úspešné ✅");
    router.push("/");
    router.refresh();
  };

  return (
    <main className="mx-auto max-w-md space-y-6">
      <section className="rentulo-card p-8">
        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
            Rentulo
          </div>

          <h1 className="text-3xl font-semibold">Prihlásenie</h1>

          <p className="text-sm leading-6 text-white/70">
            Prihlás sa do svojho účtu a pokračuj v rezerváciách, správach a správe
            svojich ponúk.
          </p>
        </div>

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
              disabled={submitting}
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm text-white/80">Heslo</div>
            <input
              className="rentulo-input-light px-3 py-2 placeholder:text-black/50"
              placeholder="Zadaj heslo"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              disabled={submitting}
            />
          </label>

          <button
            type="submit"
            className="rentulo-btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50"
            disabled={submitting}
          >
            {submitting ? "Prihlasujem..." : "Prihlásiť"}
          </button>
        </form>

        {status ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
            {status}
          </div>
        ) : null}
      </section>

      <section className="rentulo-card p-5 text-sm text-white/70">
        Nemáš účet?{" "}
        <Link href="/register" className="font-medium text-indigo-300 hover:text-indigo-200">
          Zaregistruj sa
        </Link>
      </section>
    </main>
  );
}