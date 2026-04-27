"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { sanitizeInternalPath } from "@/lib/authRedirect";
import { supabase } from "@/lib/supabaseClient";

type SupportedOtpType =
  | "signup"
  | "recovery"
  | "invite"
  | "magiclink"
  | "email"
  | "email_change";

function isSupportedOtpType(value: string | null): value is SupportedOtpType {
  return (
    value === "signup" ||
    value === "recovery" ||
    value === "invite" ||
    value === "magiclink" ||
    value === "email" ||
    value === "email_change"
  );
}

function getHashParams() {
  if (typeof window === "undefined") {
    return new URLSearchParams();
  }

  return new URLSearchParams(window.location.hash.replace(/^#/, ""));
}

type AuthCallbackViewProps = {
  errorMessage: string;
  nextPath: string;
  status: string;
};

function AuthCallbackView({ errorMessage, nextPath, status }: AuthCallbackViewProps) {
  return (
    <main className="mx-auto max-w-md space-y-6">
      <section className="rentulo-card p-8">
        <div className="space-y-3">
          <div className="inline-flex rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-sm font-medium text-indigo-300">
            Rentulo
          </div>

          <h1 className="text-3xl font-semibold">Dokoncenie prihlasenia</h1>

          <p className="text-sm leading-6 text-white/70">{status}</p>
        </div>

        {errorMessage ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {errorMessage}
          </div>
        ) : (
          <div className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">
            Presmerujem ta spat do aplikacie.
          </div>
        )}
      </section>

      <section className="rentulo-card flex items-center gap-2 p-5 text-sm text-white/70">
        <Link href={nextPath} className="font-medium text-indigo-300 hover:text-indigo-200">
          Pokracovat dalej
        </Link>
        <span className="text-white/35">|</span>
        <Link href="/login" className="font-medium text-indigo-300 hover:text-indigo-200">
          Spat na prihlasenie
        </Link>
      </section>
    </main>
  );
}

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [status, setStatus] = useState("Dokoncujem prihlasenie...");
  const [errorMessage, setErrorMessage] = useState("");

  const nextPath = useMemo(() => {
    return sanitizeInternalPath(searchParams.get("next")) ?? "/";
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    const finishAuth = async () => {
      const hashParams = getHashParams();
      const code = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const queryType = searchParams.get("type");
      const hashType = hashParams.get("type");
      const callbackType = queryType ?? hashType;
      const finalNextPath =
        sanitizeInternalPath(searchParams.get("next")) ??
        sanitizeInternalPath(hashParams.get("next")) ??
        (callbackType === "recovery" ? "/reset-password" : "/");

      const callbackError =
        searchParams.get("error_description") ||
        searchParams.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");

      if (callbackError) {
        if (!active) return;
        setErrorMessage(callbackError);
        setStatus("Prihlasenie sa nepodarilo dokoncit.");
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }
        } else if (tokenHash && isSupportedOtpType(queryType)) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: queryType,
          });

          if (error) {
            throw error;
          }
        } else {
          const accessToken = hashParams.get("access_token");
          const refreshToken = hashParams.get("refresh_token");

          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

            if (error) {
              throw error;
            }
          } else {
            const {
              data: { session },
            } = await supabase.auth.getSession();

            if (!session) {
              throw new Error("Prihlasovaci odkaz je neplatny alebo vyprsal.");
            }
          }
        }

        if (!active) return;

        if (typeof window !== "undefined" && window.location.hash) {
          window.history.replaceState(
            {},
            document.title,
            `${window.location.pathname}${window.location.search}`
          );
        }

        router.replace(finalNextPath);
        router.refresh();
      } catch (error) {
        if (!active) return;

        const message =
          error instanceof Error ? error.message : "Prihlasovaci odkaz sa nepodarilo spracovat.";
        setErrorMessage(message);
        setStatus("Prihlasenie sa nepodarilo dokoncit.");
      }
    };

    void finishAuth();

    return () => {
      active = false;
    };
  }, [router, searchParams]);

  return (
    <AuthCallbackView errorMessage={errorMessage} nextPath={nextPath} status={status} />
  );
}

function AuthCallbackFallback() {
  return (
    <AuthCallbackView
      errorMessage=""
      nextPath="/"
      status="Dokoncujem prihlasenie..."
    />
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackInner />
    </Suspense>
  );
}
