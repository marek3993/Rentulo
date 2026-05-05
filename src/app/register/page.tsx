"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buildAuthCallbackUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabaseClient";

type AccountType = "private" | "sole_trader" | "company";
type StatusTone = "info" | "success" | "error";
type StatusState = {
  tone: StatusTone;
  message: string;
};

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

function statusClassName(tone: StatusTone) {
  if (tone === "success") return "rentulo-status-success";
  if (tone === "error") return "rentulo-status-error";
  return "rentulo-status-info";
}

export default function RegisterPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [accountType, setAccountType] = useState<AccountType>("private");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<StatusState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");
  const [resendingVerification, setResendingVerification] = useState(false);
  const disabled = submitting || oauthSubmitting || !!pendingEmail;

  useEffect(() => {
    let active = true;

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (!active) return;

      setHasSession(Boolean(data.session));
      setAuthChecked(true);
    };

    syncSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;

      setHasSession(Boolean(session));
      setAuthChecked(true);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setStatus({ tone: "info", message: "Vytvaram ucet..." });

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
      setStatus({ tone: "error", message: "Chyba: " + error.message });
      setSubmitting(false);
      return;
    }

    if (data.session) {
      setStatus({ tone: "success", message: "Ucet bol vytvoreny a si prihlaseny." });
      router.push("/profile");
      router.refresh();
      return;
    }

    setPendingEmail(normalizedEmail);
    setPassword("");
    setStatus(null);
    setSubmitting(false);
  };

  const onGoogleRegister = async () => {
    setOauthSubmitting(true);
    setStatus({ tone: "info", message: "Presmerovavam na Google..." });

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: buildAuthCallbackUrl({ next: "/" }),
      },
    });

    if (error) {
      setStatus({ tone: "error", message: "Chyba: " + error.message });
      setOauthSubmitting(false);
    }
  };

  const onResendVerificationEmail = async () => {
    if (!pendingEmail) return;

    setResendingVerification(true);
    setStatus({
      tone: "info",
      message: `Posielam novy overovaci e-mail na ${pendingEmail}...`,
    });

    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
      options: {
        emailRedirectTo: buildAuthCallbackUrl({ next: "/profile" }),
      },
    });

    if (error) {
      setStatus({
        tone: "error",
        message: "Potvrdzovaci e-mail sa nepodarilo poslat znova. " + error.message,
      });
      setResendingVerification(false);
      return;
    }

    setStatus({
      tone: "success",
      message: `Poslali sme novy potvrdzovaci e-mail na ${pendingEmail}. Skontroluj aj Spam, Reklamy alebo Promo.`,
    });
    setResendingVerification(false);
  };

  if (!authChecked) {
    return (
      <main className="rentulo-auth-shell mx-auto space-y-6">
        <section className="rentulo-card rentulo-auth-card p-8 lg:p-10">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold sm:text-4xl">Overujem prihlasenie</h1>
              <p className="rentulo-auth-copy max-w-xl text-sm leading-6 sm:text-[0.95rem]">
                Chvilu pockaj. Kontrolujem, ci uz mas aktivnu session, aby sa
                registracny formular nezobrazil zbytocne.
              </p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (hasSession) {
    return (
      <main className="rentulo-auth-shell mx-auto space-y-6">
        <section className="rentulo-card rentulo-auth-card p-8 lg:p-10">
          <div className="space-y-4">
            <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
              Rentulo
            </div>

            <div className="space-y-3">
              <h1 className="text-3xl font-semibold sm:text-4xl">Uz si prihlaseny</h1>
              <p className="rentulo-auth-copy max-w-xl text-sm leading-6 sm:text-[0.95rem]">
                Novy ucet teraz nepotrebujes. Tvoja session je aktivna, takze
                mozes pokracovat rovno do profilu.
              </p>
            </div>

            <div className="rentulo-status rentulo-status-success text-sm leading-6">
              Registracny formular sme schovali, pretoze uz mas aktivne prihlasenie.
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Link href="/profile" className="rentulo-btn-primary px-4 py-3 text-sm">
                Prejst na profil
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="rentulo-auth-shell mx-auto space-y-6">
      <section className="rentulo-card rentulo-auth-card">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.04fr)_minmax(24rem,0.96fr)]">
          <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r lg:p-10">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
                Rentulo
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold sm:text-4xl">Registracia</h1>
                <p className="rentulo-auth-copy max-w-xl text-sm leading-6 sm:text-[0.95rem]">
                  Pokracuj do Rentulo cez Google alebo si vytvor ucet e-mailom. Pri
                  registracii e-mailom ti posleme potvrdzovaci e-mail a pred prvym
                  prihlasenim musis kliknut na overovaci odkaz.
                </p>
              </div>
            </div>

            {pendingEmail ? (
              <div className="rentulo-status rentulo-status-success mt-8 text-sm leading-6">
                <div className="font-semibold">Registracia je skoro hotova.</div>
                <div className="mt-2">
                  Na adresu <strong>{pendingEmail}</strong> sme poslali potvrdzovaci
                  e-mail. Pred prvym prihlasenim musis kliknut na odkaz v sprave.
                </div>
                <div className="mt-2">
                  Ak e-mail nevidis do par minut, skontroluj Spam, Reklamy alebo Promo.
                </div>

                <button
                  type="button"
                  className="mt-4 rounded-xl border border-current/20 bg-white/20 px-4 py-2 text-sm font-medium transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={onResendVerificationEmail}
                  disabled={resendingVerification}
                >
                  {resendingVerification
                    ? "Posielam overovaci e-mail znova..."
                    : "Poslat overovaci e-mail znova"}
                </button>

                {status ? (
                  <div className={`rentulo-status mt-4 text-sm ${statusClassName(status.tone)}`}>
                    {status.message}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="rentulo-status rentulo-status-info mt-8 text-sm leading-6">
                Google mozes pouzit aj na vytvorenie noveho uctu. Ak ucet k tvojej
                Google adrese uz existuje, rovno sa prihlasis. Ak este neexistuje,
                vytvori sa a dokoncis onboarding priamo v aplikacii.
              </div>
            )}
          </div>

          <div className="p-8 lg:p-10">
            <div className="space-y-3">
              <button
                type="button"
                className="rentulo-btn-primary w-full px-4 py-3 text-sm disabled:opacity-50"
                onClick={onGoogleRegister}
                disabled={disabled}
              >
                {oauthSubmitting ? "Presmerovavam..." : "Pokracovat cez Google"}
              </button>

              <div className="rentulo-auth-divider text-center text-xs uppercase tracking-[0.2em]">
                alebo vytvorit ucet e-mailom
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <fieldset className="space-y-3">
                <legend className="rentulo-auth-label text-sm font-medium">
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
                        <div className="rentulo-auth-copy mt-1 text-sm leading-6">
                          {option.description}
                        </div>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <label className="block">
                <div className="rentulo-auth-label mb-1 text-sm">E-mail</div>
                <input
                  className="rentulo-input-light px-3 py-2.5 placeholder:text-black/50"
                  placeholder="napr. tvoj@email.sk"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  required
                  disabled={disabled}
                />
              </label>

              <label className="block">
                <div className="rentulo-auth-label mb-1 text-sm">Heslo</div>
                <input
                  className="rentulo-input-light px-3 py-2.5 placeholder:text-black/50"
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
                className="rentulo-btn-secondary w-full px-4 py-3 text-sm disabled:opacity-50"
                disabled={disabled}
              >
                {submitting ? "Vytvaram ucet..." : "Vytvorit ucet"}
              </button>
            </form>

            {status && !pendingEmail ? (
              <div className={`rentulo-status mt-4 text-sm ${statusClassName(status.tone)}`}>
                {status.message}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rentulo-card p-5 text-sm rentulo-auth-copy">
        Uz mas ucet a chces sa prihlasit e-mailom?{" "}
        <Link href="/login" className="font-medium text-indigo-300 hover:text-indigo-200">
          Prihlasit sa
        </Link>
      </section>
    </main>
  );
}
