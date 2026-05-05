"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { buildAuthCallbackUrl } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabaseClient";

type StatusTone = "info" | "success" | "error";

function mapLoginErrorMessage(message: string) {
  if (message.toLowerCase().includes("email not confirmed")) {
    return "Tento e-mail este nie je potvrdeny. Najprv otvor potvrdzovaci e-mail a klikni na overovaci odkaz.";
  }

  return message;
}

function statusClassName(tone: StatusTone) {
  if (tone === "success") return "rentulo-status-success";
  if (tone === "error") return "rentulo-status-error";
  return "rentulo-status-info";
}

export default function LoginPage() {
  const router = useRouter();
  const hasRedirectedRef = useRef(false);

  const [authChecked, setAuthChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<{ tone: StatusTone; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthSubmitting, setOauthSubmitting] = useState(false);

  const disabled = submitting || oauthSubmitting;

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

  useEffect(() => {
    if (!authChecked || !hasSession || hasRedirectedRef.current) return;

    hasRedirectedRef.current = true;
    router.replace("/profile");
  }, [authChecked, hasSession, router]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    setStatus({ tone: "info", message: "Prihlasujem..." });

    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setStatus({ tone: "error", message: "Chyba: " + mapLoginErrorMessage(error.message) });
      setSubmitting(false);
      return;
    }

    setStatus({ tone: "success", message: "Prihlasenie uspesne." });
    router.push("/");
    router.refresh();
  };

  const onGoogleLogin = async () => {
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
                prihlasovaci formular nezobrazil zbytocne.
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
                Do uctu sa nemusis prihlasovat znova. Tvoja session je aktivna,
                takze mozes pokracovat priamo do profilu.
              </p>
            </div>

            <div className="rentulo-status rentulo-status-success text-sm leading-6">
              Prihlasovaci formular sme schovali a presmerovavame ta do profilu.
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
        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.95fr)_minmax(24rem,1.05fr)]">
          <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r lg:p-10">
            <div className="space-y-4">
              <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
                Rentulo
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-semibold sm:text-4xl">Prihlasenie</h1>
                <p className="rentulo-auth-copy max-w-xl text-sm leading-6 sm:text-[0.95rem]">
                  Pokracuj do Rentulo cez Google alebo e-mail. Google funguje ako
                  jednotny vstup: ak uz ucet mas, prihlasi ta, ak nie, vytvori sa a
                  pokracujes dalej.
                </p>
              </div>
            </div>

            <div className="rentulo-status rentulo-status-info mt-8 text-sm leading-6">
              Ak si sa registroval e-mailom, pred prvym prihlasenim najprv dokonci
              potvrdenie cez odkaz v e-maile. Ak spravu nevidis, skontroluj aj Spam,
              Reklamy alebo Promo.
            </div>
          </div>

          <div className="p-8 lg:p-10">
            <div className="space-y-3">
              <button
                type="button"
                className="rentulo-btn-secondary w-full px-4 py-3 text-sm disabled:opacity-50"
                onClick={onGoogleLogin}
                disabled={disabled}
              >
                {oauthSubmitting ? "Presmerovavam..." : "Pokracovat cez Google"}
              </button>

              <p className="rentulo-status rentulo-status-info text-sm leading-6">
                Ak ucet k tvojej Google adrese uz existuje, rovno sa prihlasis. Ak este
                neexistuje, vytvori sa a dokoncis profil v dalsom kroku.
              </p>

              <div className="rentulo-auth-divider text-center text-xs uppercase tracking-[0.2em]">
                alebo pokracovat e-mailom
              </div>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
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
                <div className="rentulo-auth-label mb-1 flex items-center justify-between gap-3 text-sm">
                  <span>Heslo</span>
                  <Link
                    href="/forgot-password"
                    className="font-medium text-indigo-300 hover:text-indigo-200"
                  >
                    Zabudnute heslo?
                  </Link>
                </div>
                <input
                  className="rentulo-input-light px-3 py-2.5 placeholder:text-black/50"
                  placeholder="Zadaj heslo"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  type="password"
                  required
                  disabled={disabled}
                />
              </label>

              <button
                type="submit"
                className="rentulo-btn-primary w-full px-4 py-3 text-sm disabled:opacity-50"
                disabled={disabled}
              >
                {submitting ? "Prihlasujem..." : "Prihlasit sa"}
              </button>
            </form>

            {status ? (
              <div className={`rentulo-status mt-4 text-sm ${statusClassName(status.tone)}`}>
                {status.message}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rentulo-card p-5 text-sm rentulo-auth-copy">
        Chces radsej vytvorit ucet e-mailom?{" "}
        <Link href="/register" className="font-medium text-indigo-300 hover:text-indigo-200">
          Zaregistrovat sa
        </Link>
      </section>
    </main>
  );
}
