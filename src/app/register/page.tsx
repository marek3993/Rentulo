"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { buildAuthCallbackUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabaseClient";

type AccountType = "private" | "sole_trader" | "company";

const ACCOUNT_TYPE_OPTIONS: Array<{
  value: AccountType;
  label: string;
  description: string;
}> = [
  {
    value: "private",
    label: "Sukromna osoba",
    description: "Ucet pre bezne poziciavanie a prenajimanie ako fyzicka osoba.",
  },
  {
    value: "sole_trader",
    label: "SZCO",
    description: "Ucet pre podnikanie na zivnost alebo ako samostatne zarobkovo cinna osoba.",
  },
  {
    value: "company",
    label: "Firma",
    description: "Ucet pre s.r.o., a.s. alebo inu firmu.",
  },
];

export default function RegisterPage() {
  const router = useRouter();

  const [accountType, setAccountType] = useState<AccountType>("private");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const disabled = submitting || oauthSubmitting || !!pendingEmail;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setStatus("Vytvaram ucet...");

    const normalizedEmail = email.trim();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: buildAuthCallbackUrl({ next: "/profile" }),
        data: {
          account_type: accountType,
        },
      },
    });

    if (error) {
      setStatus("Chyba: " + error.message);
      setSubmitting(false);
      return;
    }

    if (data.session) {
      setStatus("Ucet bol vytvoreny a si prihlaseny.");
      router.push("/profile");
      router.refresh();
      return;
    }

    setPendingEmail(normalizedEmail);
    setPassword("");
    setStatus("");
    setSubmitting(false);
  };

  const onGoogleRegister = async () => {
    setOauthSubmitting(true);
    setStatus("Presmerovavam na Google...");

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildAuthCallbackUrl({ next: "/" }),
      },
    });

    if (error) {
      setStatus("Chyba: " + error.message);
      setOauthSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-md space-y-6">
      <section className="rentulo-card p-8">
        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
            Rentulo
          </div>

          <h1 className="text-3xl font-semibold">Registracia</h1>

          <p className="text-sm leading-6 text-white/70">
            Vytvor si ucet cez Google alebo e-mail. Ak pojdes cez Google, ucet sa moze
            vytvorit hned a pokracujes dalej bez cakania na potvrdzovaci e-mail.
          </p>
        </div>

        {pendingEmail ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            Na adresu <strong>{pendingEmail}</strong> sme poslali odkaz na potvrdenie e-mailu.
            Otvor ho a dokonc registraciu. Odkaz ta vrati spat do Rentulo.
          </div>
        ) : null}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            className="rentulo-btn-primary w-full px-4 py-2.5 text-sm disabled:opacity-50"
            onClick={onGoogleRegister}
            disabled={disabled}
          >
            {oauthSubmitting ? "Presmerovavam..." : "Pokracovat cez Google"}
          </button>

          <p className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4 text-sm leading-6 text-white/75">
            Google mozes pouzit aj na vytvorenie noveho uctu. Po prvom prihlaseni len
            dokoncis onboarding priamo v aplikacii.
          </p>

          <div className="text-center text-xs uppercase tracking-[0.2em] text-white/35">
            alebo registracia e-mailom
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium text-white/85">
              Typ uctu pre registraciu e-mailom
            </legend>

            <div className="grid gap-3">
              {ACCOUNT_TYPE_OPTIONS.map((option) => {
                const selected = option.value === accountType;

                return (
                  <label
                    key={option.value}
                    className={`block cursor-pointer rounded-2xl border p-4 transition ${
                      selected
                        ? "border-indigo-400/60 bg-indigo-500/10"
                        : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5"
                    } ${disabled ? "pointer-events-none opacity-60" : ""}`}
                  >
                    <input
                      className="sr-only"
                      type="radio"
                      name="account-type"
                      value={option.value}
                      checked={selected}
                      onChange={() => setAccountType(option.value)}
                      disabled={disabled}
                    />

                    <div className="text-sm font-medium text-white">{option.label}</div>
                    <div className="mt-1 text-sm leading-6 text-white/65">{option.description}</div>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <label className="block">
            <div className="mb-1 text-sm text-white/80">E-mail</div>
            <input
              className="rentulo-input-light px-3 py-2 placeholder:text-black/50"
              placeholder="napr. tvoj@email.sk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              disabled={disabled}
            />
          </label>

          <label className="block">
            <div className="mb-1 text-sm text-white/80">Heslo</div>
            <input
              className="rentulo-input-light px-3 py-2 placeholder:text-black/50"
              placeholder="Minimalne 6 znakov"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              minLength={6}
              required
              disabled={disabled}
            />
          </label>

          <button
            type="submit"
            className="rentulo-btn-secondary w-full px-4 py-2.5 text-sm disabled:opacity-50"
            disabled={disabled}
          >
            {submitting ? "Vytvaram ucet..." : "Vytvorit ucet"}
          </button>
        </form>

        {status ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/75">
            {status}
          </div>
        ) : null}
      </section>

      <section className="rentulo-card p-5 text-sm text-white/70">
        Uz mas ucet?{" "}
        <Link href="/login" className="font-medium text-indigo-300 hover:text-indigo-200">
          Prihlasit sa
        </Link>
      </section>
    </main>
  );
}
